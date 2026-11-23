import { getSessionRevision } from "../../../api/client.js";
import { runServiceQuery, urbanityApi } from "../../../api/urbanityApi.js";
import { useAuth } from "../../../auth/useAuth.js";
import { ROLES } from "../../../constants/roles.js";
import { isActiveAppointment } from "../utils/appointments.js";
import { towerRepresentativeService as service } from "./towerRepresentativeService.js";

// Tower Representative appointment cache. The backend scopes every read to the
// representative's tower and authorizes every write; these tags only decide
// which cached reads to refresh.
export const towerAppointmentTagTypes = Object.freeze({
  appointment: "TowerRepresentativeAppointment",
  complaint: "TowerRepresentativeAppointmentComplaint",
  timeSlots: "TowerRepresentativeTimeSlot",
  schedule: "TowerRepresentativeWorkerSchedule",
});

const appointmentTag = (id = "LIST") => ({ type: towerAppointmentTagTypes.appointment, id });
// Appointments embed their complaint; this tag refreshes every cached read that embeds it.
const complaintTag = (complaintId) => ({ type: towerAppointmentTagTypes.complaint, id: complaintId });
const scheduleTag = (workerId, date) => ({ type: towerAppointmentTagTypes.schedule, id: `${workerId}:${date}` });

function scheduleTags(workerId, ...dates) {
  if (!workerId) return [];
  return [...new Set(dates.filter(Boolean))].map((date) => scheduleTag(workerId, date));
}

const isInactiveRequest = (error) => error?.status === 0 && error?.message === "The request is no longer active.";

// Failed writes refresh the same reads as successful ones: the appointment or a
// worker's schedule may have changed meanwhile (for example, a slot conflict).
function affected(build) {
  return (_result, error, args) => (isInactiveRequest(error) ? [] : [
    appointmentTag(),
    appointmentTag(args.id),
    ...(args.complaintId ? [complaintTag(args.complaintId)] : []),
    ...build(args),
  ]);
}

export const towerAppointmentsApi = urbanityApi
  .enhanceEndpoints({ addTagTypes: Object.values(towerAppointmentTagTypes) })
  .injectEndpoints({
    endpoints: (build) => ({
      listTowerRepresentativeAppointments: build.query({
        queryFn: (sessionRevision, { signal }) =>
          runServiceQuery(signal, () => service.listAppointments(signal), sessionRevision),
        providesTags: (appointments) => [
          appointmentTag(),
          ...(appointments ?? []).map(({ id }) => appointmentTag(id)),
          ...[...new Set((appointments ?? []).map(({ complaintId }) => complaintId).filter(Boolean))].map(complaintTag),
        ],
      }),
      getTowerRepresentativeAppointment: build.query({
        queryFn: ({ sessionRevision, id }, { signal }) =>
          runServiceQuery(signal, () => service.getAppointment(id, signal), sessionRevision),
        providesTags: (appointment, _error, { id }) => [
          appointmentTag(id),
          ...(appointment?.complaintId || appointment?.complaint?.id
            ? [complaintTag(appointment.complaintId || appointment.complaint.id)]
            : []),
        ],
      }),
      listTowerRepresentativeTimeSlots: build.query({
        queryFn: (sessionRevision, { signal }) =>
          runServiceQuery(signal, () => service.listTimeSlots(signal), sessionRevision),
        providesTags: [{ type: towerAppointmentTagTypes.timeSlots, id: "LIST" }],
      }),
      // Keyed by worker and date, so a late response for one date never replaces another date's entry.
      getTowerRepresentativeWorkerSchedule: build.query({
        queryFn: ({ sessionRevision, workerId, date }, { signal }) =>
          runServiceQuery(signal, () => service.getWorkerSchedule(workerId, date, signal), sessionRevision),
        providesTags: (_schedule, _error, { workerId, date }) => [scheduleTag(workerId, date)],
      }),

      // args: { id, complaintId, workerId, scheduledDate, timeSlot }
      confirmTowerRepresentativeAppointment: build.mutation({
        queryFn: ({ id, workerId, scheduledDate, timeSlot }, { signal }) =>
          runServiceQuery(signal, async () => (await service.confirmAppointment(id, { workerId, scheduledDate, timeSlot }, signal)) ?? null),
        invalidatesTags: affected(({ workerId, scheduledDate }) => scheduleTags(workerId, scheduledDate)),
      }),
      // args: { id, complaintId, workerId, previousDate, decision, scheduledDate, timeSlot, note }
      decideTowerRepresentativeReschedule: build.mutation({
        queryFn: ({ id, decision, scheduledDate, timeSlot, note }, { signal }) =>
          runServiceQuery(signal, async () => (await service.decideReschedule(id, { decision, scheduledDate, timeSlot, note }, signal)) ?? null),
        // Approval frees the old date and books the new one; a decline leaves the schedule unchanged.
        invalidatesTags: affected(({ decision, workerId, previousDate, scheduledDate }) => (
          decision === "APPROVE" ? scheduleTags(workerId, previousDate, scheduledDate) : []
        )),
      }),
      // args: { id, complaintId, workerId, scheduledDate, reason }
      cancelTowerRepresentativeAppointment: build.mutation({
        queryFn: ({ id, reason }, { signal }) =>
          runServiceQuery(signal, async () => (await service.cancelAppointment(id, reason, signal)) ?? null),
        invalidatesTags: affected(({ workerId, scheduledDate }) => scheduleTags(workerId, scheduledDate)),
      }),
      // args: { id, complaintId, workerId, scheduledDate, reason }
      markTowerRepresentativeAppointmentMissed: build.mutation({
        queryFn: ({ id, reason }, { signal }) =>
          runServiceQuery(signal, async () => (await service.markAppointmentMissed(id, reason, signal)) ?? null),
        invalidatesTags: affected(({ workerId, scheduledDate }) => scheduleTags(workerId, scheduledDate)),
      }),
    }),
  });

// Builds the invalidation context for a write from a loaded appointment.
export function appointmentWriteContext(appointment) {
  return {
    id: appointment.id,
    complaintId: appointment.complaintId || appointment.complaint?.id,
    workerId: appointment.workerId,
    scheduledDate: appointment.scheduledDate,
  };
}

export async function mutateTowerAppointment(dispatch, endpoint, args) {
  const request = dispatch(towerAppointmentsApi.endpoints[endpoint].initiate(args));
  try { return await request.unwrap(); }
  finally { request.reset(); }
}

// Complaint transitions change the complaint embedded in its appointments.
export function refreshComplaintAppointments(dispatch, complaintId, revision = getSessionRevision()) {
  if (complaintId && revision === getSessionRevision()) {
    dispatch(towerAppointmentsApi.util.invalidateTags([complaintTag(complaintId)]));
  }
}

export const CLOSE_CANCELLATION_REASON = "Complaint closed; the visit is no longer needed.";

// Active visits the representative may still cancel (the backend refuses once the worker has arrived).
export const cancellableAppointments = (appointments) =>
  appointments.filter((item) => isActiveAppointment(item) && !item.arrivedAt);

const closuresInFlight = new Map();

// Always reads the current list from the backend instead of trusting whatever is cached.
async function loadCurrentAppointments(dispatch, revision) {
  const request = dispatch(towerAppointmentsApi.endpoints.listTowerRepresentativeAppointments.initiate(revision, { forceRefetch: true }));
  try { return await request.unwrap(); }
  finally { request.unsubscribe(); }
}

function assertSameSession(revision) {
  if (revision !== getSessionRevision()) throw new Error("The session changed, so the complaint was not closed.");
}

async function runComplaintClosure(dispatch, complaintId, revision) {
  let appointments;
  try {
    appointments = await loadCurrentAppointments(dispatch, revision);
  } catch (error) {
    throw new Error(`The complaint was not closed because its appointments could not be checked. ${error.message}`);
  }
  const pending = cancellableAppointments(appointments.filter((item) => item.complaintId === complaintId));
  let cancelled = 0;
  // Cancel first, one at a time: if a cancellation fails, the complaint is left open so nothing is half-closed.
  for (const appointment of pending) {
    assertSameSession(revision);
    try {
      await mutateTowerAppointment(dispatch, "cancelTowerRepresentativeAppointment", {
        ...appointmentWriteContext(appointment), reason: CLOSE_CANCELLATION_REASON,
      });
      cancelled += 1;
    } catch (error) {
      throw new Error(cancelled
        ? `${cancelled} of ${pending.length} active appointments were cancelled, but the next cancellation failed: ${error.message} The complaint was not closed.`
        : `The complaint was not closed because its active appointment could not be cancelled. ${error.message}`);
    }
  }
  assertSameSession(revision);
  await service.closeComplaint(complaintId);
  refreshComplaintAppointments(dispatch, complaintId, revision);
  return { cancelledAppointments: cancelled };
}

// Repeated submissions for the same complaint share one closure instead of sending duplicate writes.
export function closeTowerComplaint(dispatch, complaintId) {
  const revision = getSessionRevision();
  const key = `${revision}:${complaintId}`;
  if (!closuresInFlight.has(key)) {
    closuresInFlight.set(key, runComplaintClosure(dispatch, complaintId, revision)
      .finally(() => closuresInFlight.delete(key)));
  }
  return closuresInFlight.get(key);
}

function useTowerSession() {
  const { authenticated, loading, sessionRevision, user } = useAuth();
  return { sessionRevision, skip: !authenticated || loading || user?.role !== ROLES.TOWER_REPRESENTATIVE };
}

// Presents a query in the shape the Tower Representative pages already use.
function asResource(result, skip) {
  const data = result.isError ? null : (result.currentData ?? null);
  const error = result.isError ? result.error : null;
  return {
    data,
    error,
    loading: result.isFetching,
    initialLoading: !skip && !data && !error,
    reload: () => (skip ? Promise.resolve(null) : result.refetch()),
  };
}

export function useTowerAppointments() {
  const { sessionRevision, skip } = useTowerSession();
  const result = towerAppointmentsApi.useListTowerRepresentativeAppointmentsQuery(sessionRevision, {
    skip, refetchOnMountOrArgChange: true,
  });
  return asResource(result, skip);
}

export function useTowerAppointment(id) {
  const session = useTowerSession();
  const skip = session.skip || !id;
  const result = towerAppointmentsApi.useGetTowerRepresentativeAppointmentQuery(
    { sessionRevision: session.sessionRevision, id }, { skip, refetchOnMountOrArgChange: true },
  );
  return asResource(result, skip);
}

export function useTowerTimeSlots() {
  const { sessionRevision, skip } = useTowerSession();
  return asResource(towerAppointmentsApi.useListTowerRepresentativeTimeSlotsQuery(sessionRevision, { skip }), skip);
}

export function useTowerWorkerSchedule(workerId, date) {
  const session = useTowerSession();
  const skip = session.skip || !workerId || !date;
  const result = towerAppointmentsApi.useGetTowerRepresentativeWorkerScheduleQuery(
    { sessionRevision: session.sessionRevision, workerId, date },
    // Availability changes as other appointments are booked, so revalidate when a picker opens.
    { skip, refetchOnMountOrArgChange: true },
  );
  return asResource(result, skip);
}
