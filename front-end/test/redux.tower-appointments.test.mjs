import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { AxiosError } from "axios";
import { createServer } from "vite";
import { setTimeout as delay } from "node:timers/promises";

let vite, client, stores, feature, api, originalAdapter;
const testStores = [];
const representative = { id: "rep", email: "rep@example.test", role: "TOWER_REPRESENTATIVE" };
const D1 = "2026-12-01", D2 = "2026-12-02", D3 = "2026-12-03";
const S9 = "09:00-10:00", S11 = "11:00-12:00";
const ok = (data) => ({ status: 200, data: { success: true, data } });
function fail(config, status, message) {
  throw new AxiosError("Request failed", undefined, config, undefined, {
    status, data: { error: { message }, privateDiagnostic: "must-not-enter-redux" },
  });
}

before(async () => {
  vite = await createServer({ configFile: false, logLevel: "error", server: { middlewareMode: true, watch: null, ws: false } });
  client = await vite.ssrLoadModule("/src/api/client.js");
  stores = await vite.ssrLoadModule("/src/app/store.js");
  feature = await vite.ssrLoadModule("/src/features/tower-representative/services/towerAppointmentsApi.js");
  api = feature.towerAppointmentsApi;
  originalAdapter = client.api.defaults.adapter;
  const storage = new Map();
  globalThis.window = { sessionStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  } };
});
beforeEach(() => client.saveSession("tower-session", representative));
afterEach(() => {
  for (const store of testStores.splice(0)) store.dispatch(api.util.resetApiState());
  client.api.defaults.adapter = originalAdapter;
  client.clearSession();
});
after(async () => { delete globalThis.window; await vite?.close(); });

// A fresh store per test, built with the real application store configuration.
function freshStore() {
  const store = stores.createAppStore();
  testStores.push(store);
  return store;
}
const revision = () => client.getSessionRevision();
const query = (store, endpoint, args) => store.dispatch(api.endpoints[endpoint].initiate(args));
const list = (store) => query(store, "listTowerRepresentativeAppointments", revision());
const detail = (store, id) => query(store, "getTowerRepresentativeAppointment", { sessionRevision: revision(), id });
const slots = (store) => query(store, "listTowerRepresentativeTimeSlots", revision());
const schedule = (store, workerId, date) => query(store, "getTowerRepresentativeWorkerSchedule", { sessionRevision: revision(), workerId, date });
const write = (store, endpoint, args) => feature.mutateTowerAppointment(store.dispatch, endpoint, args);
const select = (store, endpoint, args) => api.endpoints[endpoint].select(args)(store.getState());
const selectSchedule = (store, workerId, date) =>
  select(store, "getTowerRepresentativeWorkerSchedule", { sessionRevision: revision(), workerId, date });
const selectDetail = (store, id) => select(store, "getTowerRepresentativeAppointment", { sessionRevision: revision(), id });
const selectList = (store) => select(store, "listTowerRepresentativeAppointments", revision());
async function settle(store) {
  // RTK Query can defer invalidation until an earlier query finishes.
  let pending;
  do {
    pending = store.dispatch(api.util.getRunningQueriesThunk());
    await Promise.all(pending);
  } while (pending.length);
}

// In-memory backend that mirrors the appointment contract the service uses.
function model() {
  const complaints = {
    c1: { id: "c1", title: "Leak", status: "UNDER_REVIEW", assignedWorkerId: null, responsibleUserId: "rep" },
    c2: { id: "c2", title: "Socket", status: "ASSIGNED", assignedWorkerId: "w1", responsibleUserId: "rep" },
    c3: { id: "c3", title: "Lift", status: "ASSIGNED", assignedWorkerId: "w2", responsibleUserId: "other-rep" },
  };
  const appointments = {
    a0: { id: "a0", complaintId: "c1", status: "CANCELLED", workerId: null, scheduledDate: null, scheduledTimeSlot: null },
    a1: { id: "a1", complaintId: "c1", status: "REQUESTED", requestedDate: D1, requestedTimeSlot: S9, workerId: null, scheduledDate: null, scheduledTimeSlot: null },
    a2: { id: "a2", complaintId: "c2", status: "RESCHEDULE_REQUESTED", workerId: "w1", scheduledDate: D1, scheduledTimeSlot: S11,
      rescheduleRequest: { proposedDate: D2, proposedTimeSlot: S9, reason: "Travelling" } },
    a3: { id: "a3", complaintId: "c3", status: "CONFIRMED", workerId: "w2", scheduledDate: D1, scheduledTimeSlot: S9 },
  };
  const reads = {}, writes = [], controls = { failList: null, failCancel: new Set(), delayList: null };
  const embed = (appointment) => structuredClone({ ...appointment, complaint: complaints[appointment.complaintId] });
  const count = (key) => { reads[key] = (reads[key] || 0) + 1; };
  const booked = (workerId, date, timeSlot, ignore) => Object.values(appointments).some((item) =>
    item.id !== ignore && item.status === "CONFIRMED" && item.workerId === workerId && item.scheduledDate === date && item.scheduledTimeSlot === timeSlot);
  const handler = async (config) => {
    // Appointment requests are cancellable; the existing complaint service is unchanged.
    if (config.url.startsWith("/appointments")) assert.ok(config.signal, `${config.method} ${config.url} must be cancellable`);
    assert.match(config.headers.Authorization, /^Bearer tower-session$/);
    const { url } = config;
    if (config.method === "get") {
      if (url === "/appointments") {
        count(url);
        if (controls.delayList) await controls.delayList;
        if (controls.failList) fail(config, controls.failList.status, controls.failList.message);
        return ok(Object.values(appointments).map(embed));
      }
      if (url === "/appointments/time-slots") { count(url); return ok([{ code: S9, label: "09:00 – 10:00" }, { code: S11, label: "11:00 – 12:00" }]); }
      const scheduleMatch = url.match(/^\/appointments\/workers\/(.+)\/schedule$/);
      if (scheduleMatch) {
        const date = config.params?.date;
        count(`${url}?${date}`);
        return ok({ workerId: scheduleMatch[1], date, bookedSlots: Object.values(appointments)
          .filter((item) => item.status === "CONFIRMED" && item.workerId === scheduleMatch[1] && item.scheduledDate === date)
          .map((item) => ({ appointmentId: item.id, date, timeSlot: item.scheduledTimeSlot, status: item.status })) });
      }
      const detailMatch = url.match(/^\/appointments\/([^/]+)$/);
      if (detailMatch) {
        count(url);
        if (!appointments[detailMatch[1]]) fail(config, 404, "Appointment not found.");
        return ok(embed(appointments[detailMatch[1]]));
      }
    }
    const complaintStatus = url.match(/^\/complaints\/([^/]+)\/status$/);
    if (config.method === "patch" && complaintStatus) {
      const body = JSON.parse(config.data);
      writes.push({ url, body });
      Object.assign(complaints[complaintStatus[1]], body);
      return ok(structuredClone(complaints[complaintStatus[1]]));
    }
    const action = url.match(/^\/appointments\/([^/]+)\/(confirm|reschedule-decision|cancel|missed)$/);
    assert.ok(config.method === "patch" && action, `Unexpected route ${config.method} ${url}`);
    const body = JSON.parse(config.data);
    writes.push({ url, body });
    const appointment = appointments[action[1]];
    const complaint = complaints[appointment.complaintId];
    if (complaint.responsibleUserId !== representative.id) fail(config, 403, "Only the responsible authority can manage this appointment.");
    if (action[2] === "confirm") {
      if (booked(body.workerId, body.scheduledDate, body.timeSlot, appointment.id)) fail(config, 409, "The worker already has a confirmed visit in this slot.");
      Object.assign(appointment, { status: "CONFIRMED", workerId: body.workerId, scheduledDate: body.scheduledDate, scheduledTimeSlot: body.timeSlot });
      if (!complaint.assignedWorkerId) Object.assign(complaint, { status: "ASSIGNED", assignedWorkerId: body.workerId });
    } else if (action[2] === "reschedule-decision") {
      if (body.decision === "APPROVE") {
        if (booked(appointment.workerId, body.scheduledDate, body.timeSlot, appointment.id)) fail(config, 409, "The worker already has a confirmed visit in this slot.");
        Object.assign(appointment, { scheduledDate: body.scheduledDate, scheduledTimeSlot: body.timeSlot });
      }
      Object.assign(appointment, { status: "CONFIRMED", rescheduleRequest: null });
    } else {
      if (!body.reason) fail(config, 400, ["reason should not be empty", "reason must be a string"]);
      if (action[2] === "cancel" && controls.failCancel.has(appointment.id)) fail(config, 409, "The worker has already arrived for this visit.");
      appointment.status = action[2] === "cancel" ? "CANCELLED" : "MISSED";
    }
    return ok(embed(appointment));
  };
  client.api.defaults.adapter = (config) => (model.delay ? model.delay(config, handler) : handler(config));
  return { complaints, appointments, reads, writes, controls };
}

const context = (store, id) => feature.appointmentWriteContext(selectDetail(store, id).data);

test("lists tower appointments with their embedded complaints", async () => {
  const store = freshStore(), { reads } = model();
  const appointments = await list(store).unwrap();
  assert.deepEqual(appointments.map(({ id }) => id), ["a0", "a1", "a2", "a3"]);
  assert.equal(appointments[1].complaint.status, "UNDER_REVIEW");
  assert.equal(reads["/appointments"], 1);
});

test("loads an appointment detail with its existing response structure", async () => {
  const store = freshStore(); model();
  const appointment = await detail(store, "a2").unwrap();
  assert.equal(appointment.status, "RESCHEDULE_REQUESTED");
  assert.deepEqual(appointment.rescheduleRequest, { proposedDate: D2, proposedTimeSlot: S9, reason: "Travelling" });
  assert.equal(appointment.complaint.id, "c2");
});

test("reuses list, detail, time-slot and schedule caches across subscribers", async () => {
  const store = freshStore(), { reads } = model();
  // Appointments page, dashboard and complaint page subscribe to the same list.
  await Promise.all([list(store).unwrap(), list(store).unwrap(), list(store).unwrap()]);
  await Promise.all([detail(store, "a1").unwrap(), detail(store, "a1").unwrap()]);
  // Confirm and reschedule modals share the time slots.
  await Promise.all([slots(store).unwrap(), slots(store).unwrap()]);
  await schedule(store, "w1", D1).unwrap();
  await schedule(store, "w1", D1).unwrap();
  assert.equal(reads["/appointments"], 1);
  assert.equal(reads["/appointments/a1"], 1);
  assert.equal(reads["/appointments/time-slots"], 1);
  assert.equal(reads[`/appointments/workers/w1/schedule?${D1}`], 1);
});

test("caches worker schedules separately by worker and date", async () => {
  const store = freshStore(), { reads } = model();
  await Promise.all([schedule(store, "w1", D1).unwrap(), schedule(store, "w1", D2).unwrap(), schedule(store, "w2", D1).unwrap()]);
  await schedule(store, "w1", D1).unwrap();
  assert.deepEqual(selectSchedule(store, "w1", D1).data.bookedSlots, []);
  assert.deepEqual(selectSchedule(store, "w2", D1).data.bookedSlots.map(({ appointmentId }) => appointmentId), ["a3"]);
  assert.equal(selectSchedule(store, "w1", D2).data.date, D2);
  assert.equal(reads[`/appointments/workers/w1/schedule?${D1}`], 1);
  assert.equal(reads[`/appointments/workers/w1/schedule?${D2}`], 1);
  assert.equal(reads[`/appointments/workers/w2/schedule?${D1}`], 1);
});

test("loads the time-slot catalogue", async () => {
  const store = freshStore(); model();
  assert.deepEqual((await slots(store).unwrap()).map(({ code }) => code), [S9, S11]);
});

test("confirmation sends the existing payload and refreshes the list, detail and that schedule date only", async () => {
  const store = freshStore(), { reads, writes } = model();
  await Promise.all([list(store).unwrap(), detail(store, "a1").unwrap(), slots(store).unwrap(),
    schedule(store, "w1", D1).unwrap(), schedule(store, "w1", D3).unwrap()]);
  await write(store, "confirmTowerRepresentativeAppointment", { ...context(store, "a1"), workerId: "w1", scheduledDate: D1, timeSlot: S9 });
  await settle(store);
  assert.deepEqual(writes, [{ url: "/appointments/a1/confirm", body: { workerId: "w1", scheduledDate: D1, timeSlot: S9 } }]);
  assert.equal(selectDetail(store, "a1").data.status, "CONFIRMED");
  assert.equal(selectList(store).data.find(({ id }) => id === "a1").status, "CONFIRMED");
  assert.deepEqual(selectSchedule(store, "w1", D1).data.bookedSlots.map(({ appointmentId }) => appointmentId), ["a1"]);
  assert.equal(reads["/appointments"], 2);
  assert.equal(reads["/appointments/a1"], 2);
  assert.equal(reads[`/appointments/workers/w1/schedule?${D1}`], 2);
  assert.equal(reads[`/appointments/workers/w1/schedule?${D3}`], 1);
  assert.equal(reads["/appointments/time-slots"], 1);
});

test("approving a reschedule sends the new slot and note and refreshes the detail", async () => {
  const store = freshStore(), { writes } = model();
  await detail(store, "a2").unwrap();
  const before = selectDetail(store, "a2").data;
  await write(store, "decideTowerRepresentativeReschedule", {
    ...context(store, "a2"), previousDate: before.scheduledDate, decision: "APPROVE", scheduledDate: D2, timeSlot: S9, note: "See you then",
  });
  await settle(store);
  assert.deepEqual(writes[0], { url: "/appointments/a2/reschedule-decision", body: { decision: "APPROVE", scheduledDate: D2, timeSlot: S9, note: "See you then" } });
  const after = selectDetail(store, "a2").data;
  assert.equal(after.status, "CONFIRMED");
  assert.equal(after.scheduledDate, D2);
  assert.equal(after.rescheduleRequest, null);
});

test("declining a reschedule omits the slot, keeps the visit and leaves schedules cached", async () => {
  const store = freshStore(), { reads, writes } = model();
  await Promise.all([detail(store, "a2").unwrap(), schedule(store, "w1", D1).unwrap(), schedule(store, "w1", D2).unwrap()]);
  await write(store, "decideTowerRepresentativeReschedule", {
    ...context(store, "a2"), previousDate: D1, decision: "DECLINE", scheduledDate: D2, timeSlot: S9, note: "",
  });
  await settle(store);
  assert.deepEqual(writes[0].body, { decision: "DECLINE" });
  assert.equal(selectDetail(store, "a2").data.scheduledDate, D1);
  assert.equal(selectDetail(store, "a2").data.status, "CONFIRMED");
  assert.equal(reads["/appointments/a2"], 2);
  assert.equal(reads[`/appointments/workers/w1/schedule?${D1}`], 1);
  assert.equal(reads[`/appointments/workers/w1/schedule?${D2}`], 1);
});

test("an approved cross-date reschedule refreshes both the old and new schedule dates only", async () => {
  const store = freshStore(), { appointments, reads } = model();
  appointments.a2.status = "CONFIRMED";
  await Promise.all([detail(store, "a2").unwrap(), schedule(store, "w1", D1).unwrap(), schedule(store, "w1", D2).unwrap(),
    schedule(store, "w1", D3).unwrap(), schedule(store, "w2", D1).unwrap()]);
  assert.deepEqual(selectSchedule(store, "w1", D1).data.bookedSlots.map(({ timeSlot }) => timeSlot), [S11]);
  appointments.a2.status = "RESCHEDULE_REQUESTED";
  await write(store, "decideTowerRepresentativeReschedule", {
    ...context(store, "a2"), previousDate: D1, decision: "APPROVE", scheduledDate: D2, timeSlot: S9,
  });
  await settle(store);
  assert.deepEqual(selectSchedule(store, "w1", D1).data.bookedSlots, []);
  assert.deepEqual(selectSchedule(store, "w1", D2).data.bookedSlots.map(({ timeSlot }) => timeSlot), [S9]);
  assert.equal(reads[`/appointments/workers/w1/schedule?${D1}`], 2);
  assert.equal(reads[`/appointments/workers/w1/schedule?${D2}`], 2);
  assert.equal(reads[`/appointments/workers/w1/schedule?${D3}`], 1);
  assert.equal(reads[`/appointments/workers/w2/schedule?${D1}`], 1);
});

test("cancellation sends the reason and refreshes the appointment and its worker's schedule", async () => {
  const store = freshStore(), { reads, writes } = model();
  await Promise.all([list(store).unwrap(), detail(store, "a2").unwrap(), schedule(store, "w1", D1).unwrap()]);
  await write(store, "cancelTowerRepresentativeAppointment", { ...context(store, "a2"), reason: "No longer needed" });
  await settle(store);
  assert.deepEqual(writes[0], { url: "/appointments/a2/cancel", body: { reason: "No longer needed" } });
  assert.equal(selectDetail(store, "a2").data.status, "CANCELLED");
  assert.equal(selectList(store).data.find(({ id }) => id === "a2").status, "CANCELLED");
  assert.equal(reads[`/appointments/workers/w1/schedule?${D1}`], 2);
});

test("marking a visit missed sends the reason and refreshes the list and detail", async () => {
  const store = freshStore(), { appointments, writes } = model();
  appointments.a2.status = "CONFIRMED";
  await Promise.all([list(store).unwrap(), detail(store, "a2").unwrap()]);
  await write(store, "markTowerRepresentativeAppointmentMissed", { ...context(store, "a2"), reason: "Resident absent" });
  await settle(store);
  assert.deepEqual(writes[0], { url: "/appointments/a2/missed", body: { reason: "Resident absent" } });
  assert.equal(selectDetail(store, "a2").data.status, "MISSED");
  assert.equal(selectList(store).data.find(({ id }) => id === "a2").status, "MISSED");
});

test("a slot conflict keeps the backend message and refreshes the worker's availability", async () => {
  const store = freshStore(), { appointments, reads } = model();
  appointments.a3.scheduledTimeSlot = S11;
  await Promise.all([detail(store, "a1").unwrap(), schedule(store, "w2", D1).unwrap()]);
  assert.deepEqual(selectSchedule(store, "w2", D1).data.bookedSlots.map(({ timeSlot }) => timeSlot), [S11]);
  // Another booking takes the 09:00 slot after the picker loaded availability.
  appointments.a3.scheduledTimeSlot = S9;
  await assert.rejects(
    write(store, "confirmTowerRepresentativeAppointment", { ...context(store, "a1"), workerId: "w2", scheduledDate: D1, timeSlot: S9 }),
    (error) => error.status === 409 && error.message === "The worker already has a confirmed visit in this slot.",
  );
  await settle(store);
  assert.deepEqual(selectSchedule(store, "w2", D1).data.bookedSlots.map(({ timeSlot }) => timeSlot), [S9]);
  assert.equal(selectDetail(store, "a1").data.status, "REQUESTED");
  assert.equal(reads[`/appointments/workers/w2/schedule?${D1}`], 2);
});

test("out-of-order schedule responses stay with their own worker and date", async () => {
  const store = freshStore(); model();
  const gates = new Map();
  model.delay = (config, handler) => {
    const gate = Promise.withResolvers();
    gates.set(config.params?.date, gate);
    return gate.promise.then(() => handler(config));
  };
  try {
    // The picker moves from D1 to D2 before the D1 response arrives.
    const first = schedule(store, "w2", D1);
    const second = schedule(store, "w2", D2);
    gates.get(D2).resolve();
    await second.unwrap();
    gates.get(D1).resolve();
    await first.unwrap();
    assert.equal(selectSchedule(store, "w2", D2).data.date, D2);
    assert.deepEqual(selectSchedule(store, "w2", D2).data.bookedSlots, []);
    assert.deepEqual(selectSchedule(store, "w2", D1).data.bookedSlots.map(({ appointmentId }) => appointmentId), ["a3"]);
  } finally {
    delete model.delay;
  }
});

test("backend validation errors are preserved as plain messages without raw response data", async () => {
  const store = freshStore(), { appointments } = model();
  await detail(store, "a2").unwrap();
  await assert.rejects(
    write(store, "cancelTowerRepresentativeAppointment", { ...context(store, "a2"), reason: "" }),
    (error) => {
      assert.deepEqual(error, { status: 400, message: "reason should not be empty, reason must be a string" });
      return true;
    },
  );
  await settle(store);
  assert.equal(appointments.a2.status, "RESCHEDULE_REQUESTED");
  assert.doesNotMatch(JSON.stringify(store.getState()), /must-not-enter-redux|tower-session/);
  const missing = await detail(store, "missing");
  assert.deepEqual(missing.error, { status: 404, message: "Appointment not found. Check VITE_API_URL and the backend route (login uses POST /auth/login)." });
});

test("same-tower read access does not grant mutation authority", async () => {
  const store = freshStore(), { appointments, writes } = model();
  const appointment = await detail(store, "a3").unwrap();
  assert.equal(appointment.complaint.responsibleUserId, "other-rep");
  assert.ok((await list(store).unwrap()).some(({ id }) => id === "a3"));
  await assert.rejects(
    write(store, "cancelTowerRepresentativeAppointment", { ...context(store, "a3"), reason: "Not mine" }),
    (error) => error.status === 403 && error.message === "Only the responsible authority can manage this appointment.",
  );
  await settle(store);
  assert.equal(writes.length, 1);
  assert.equal(appointments.a3.status, "CONFIRMED");
  assert.equal(selectDetail(store, "a3").data.status, "CONFIRMED");
  assert.equal(selectDetail(store, "a3").isError, false);
});

test("confirmation that assigns a worker refreshes every cached appointment embedding that complaint", async () => {
  const store = freshStore(), { reads } = model();
  await Promise.all([list(store).unwrap(), detail(store, "a0").unwrap(), detail(store, "a1").unwrap(), detail(store, "a3").unwrap()]);
  await write(store, "confirmTowerRepresentativeAppointment", { ...context(store, "a1"), workerId: "w1", scheduledDate: D1, timeSlot: S9 });
  await settle(store);
  // a0 is an earlier visit for the same complaint; its embedded complaint must not stay UNDER_REVIEW.
  assert.equal(selectDetail(store, "a0").data.complaint.status, "ASSIGNED");
  assert.equal(selectDetail(store, "a0").data.complaint.assignedWorkerId, "w1");
  assert.equal(selectList(store).data.find(({ id }) => id === "a1").complaint.status, "ASSIGNED");
  assert.equal(reads["/appointments/a0"], 2);
  assert.equal(reads["/appointments/a3"], 1);

  // Complaint transitions made on the complaint page refresh only that complaint's appointments.
  feature.refreshComplaintAppointments(store.dispatch, "c3");
  await settle(store);
  assert.equal(reads["/appointments/a3"], 2);
  assert.equal(reads["/appointments/a0"], 2);
});

test("writes started under a previous session do not refresh the new session's cache", async () => {
  const store = freshStore(), { reads } = model();
  await detail(store, "a3").unwrap();
  const stale = revision();
  client.saveSession("tower-session", { ...representative, id: "rep-2" });
  feature.refreshComplaintAppointments(store.dispatch, "c3", stale);
  await settle(store);
  assert.equal(reads["/appointments/a3"], 1);
});

// Complaint closure: cancel every active appointment of the complaint first, then close.
const close = (store, complaintId) => feature.closeTowerComplaint(store.dispatch, complaintId);
const closeWrite = (complaintId) => ({ url: `/complaints/${complaintId}/status`, body: { status: "CLOSED" } });
const cancelWrite = (id) => ({ url: `/appointments/${id}/cancel`, body: { reason: feature.CLOSE_CANCELLATION_REASON } });
function addSecondVisit(appointments) {
  appointments.a5 = { id: "a5", complaintId: "c2", status: "CONFIRMED", workerId: "w1", scheduledDate: D3, scheduledTimeSlot: S9 };
}

test("closure re-reads an already loaded appointment list instead of trusting the cache", async () => {
  const store = freshStore(), { appointments, reads, writes } = model();
  await list(store).unwrap();
  // Booked after the page loaded its list.
  addSecondVisit(appointments);
  const result = await close(store, "c2");
  assert.deepEqual(result, { cancelledAppointments: 2 });
  assert.deepEqual(writes, [cancelWrite("a2"), cancelWrite("a5"), closeWrite("c2")]);
  assert.ok(reads["/appointments"] >= 2);
});

test("closure waits for an appointment list that has not loaded yet", async () => {
  const store = freshStore(), { controls, writes } = model();
  const gate = Promise.withResolvers();
  controls.delayList = gate.promise;
  const pageList = list(store);
  const closure = close(store, "c1");
  await delay();
  assert.deepEqual(writes, []);
  gate.resolve();
  await pageList.unwrap();
  assert.deepEqual(await closure, { cancelledAppointments: 1 });
  assert.deepEqual(writes, [cancelWrite("a1"), closeWrite("c1")]);
});

test("closure stops without writes when the appointment list request fails", async () => {
  const store = freshStore(), { complaints, controls, writes } = model();
  controls.failList = { status: 500, message: "Appointments are temporarily unavailable." };
  await assert.rejects(close(store, "c1"), {
    message: "The complaint was not closed because its appointments could not be checked. Appointments are temporarily unavailable.",
  });
  assert.deepEqual(writes, []);
  assert.equal(complaints.c1.status, "UNDER_REVIEW");
});

test("closure with no active appointments only closes the complaint", async () => {
  const store = freshStore(), { appointments, writes } = model();
  appointments.a1.status = "COMPLETED";
  assert.deepEqual(await close(store, "c1"), { cancelledAppointments: 0 });
  assert.deepEqual(writes, [closeWrite("c1")]);
});

test("closure cancels multiple active appointments in order before closing", async () => {
  const store = freshStore(), { appointments, complaints, writes } = model();
  addSecondVisit(appointments);
  // Only this complaint's visits are cancelled; a3 belongs to another complaint.
  assert.deepEqual(await close(store, "c2"), { cancelledAppointments: 2 });
  assert.deepEqual(writes, [cancelWrite("a2"), cancelWrite("a5"), closeWrite("c2")]);
  assert.equal(appointments.a3.status, "CONFIRMED");
  assert.equal(complaints.c2.status, "CLOSED");
});

test("a failed cancellation leaves the complaint open and reports what happened", async () => {
  const store = freshStore(), { appointments, complaints, controls, writes } = model();
  addSecondVisit(appointments);
  controls.failCancel.add("a5");
  await assert.rejects(close(store, "c2"), {
    message: "1 of 2 active appointments were cancelled, but the next cancellation failed: The worker has already arrived for this visit. The complaint was not closed.",
  });
  assert.deepEqual(writes, [cancelWrite("a2"), cancelWrite("a5")]);
  assert.equal(complaints.c2.status, "ASSIGNED");
  assert.equal(appointments.a5.status, "CONFIRMED");

  controls.failCancel.add("a1");
  await assert.rejects(close(store, "c1"), {
    message: "The complaint was not closed because its active appointment could not be cancelled. The worker has already arrived for this visit.",
  });
  assert.equal(complaints.c1.status, "UNDER_REVIEW");
});

test("successful closure refreshes the cached appointments and skips visits the worker has arrived for", async () => {
  const store = freshStore(), { appointments, writes } = model();
  addSecondVisit(appointments);
  appointments.a5.arrivedAt = "2026-12-03T09:05:00.000Z";
  await Promise.all([list(store).unwrap(), detail(store, "a2").unwrap()]);
  assert.deepEqual(await close(store, "c2"), { cancelledAppointments: 1 });
  await settle(store);
  assert.deepEqual(writes, [cancelWrite("a2"), closeWrite("c2")]);
  assert.equal(selectDetail(store, "a2").data.status, "CANCELLED");
  assert.equal(selectDetail(store, "a2").data.complaint.status, "CLOSED");
  assert.equal(selectList(store).data.find(({ id }) => id === "a2").status, "CANCELLED");
});

test("repeated closure submissions share one closure and send each write once", async () => {
  const store = freshStore(), { appointments, writes } = model();
  addSecondVisit(appointments);
  const first = close(store, "c2");
  const second = close(store, "c2");
  assert.equal(first, second);
  await Promise.all([first, second]);
  assert.deepEqual(writes, [cancelWrite("a2"), cancelWrite("a5"), closeWrite("c2")]);
  // A later submission starts a new closure rather than reusing the finished one.
  const again = close(store, "c2");
  assert.notEqual(again, first);
  await again;
  assert.deepEqual(writes.at(-1), closeWrite("c2"));
});
