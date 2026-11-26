import assert from "node:assert/strict";
import { test } from "node:test";
import { ROLES } from "../../constants/roles.js";
import { costLine, decisionActions, estimateStatusLabel, estimateTotal, validateEstimate } from "./estimateModel.js";

const details = {
  inspection: " Cracked drain trap. ",
  proposedResolution: " Replace trap and test. ",
  completionHours: "2",
  notes: " Under the sink. ",
};
const cost = (unitPrice, quantity = "2") => costLine({ category: "MATERIAL", description: " Drain trap ", quantity, unitPrice });

test("estimates count in paise and validate totals, descriptions and inspection details", () => {
  const lines = [cost("42.35"), cost("0.1", "3"), cost("0", "1")];
  assert.equal(estimateTotal(lines), 8500);
  assert.deepEqual(validateEstimate(details, lines), {
    inspection: "Cracked drain trap.", proposedResolution: "Replace trap and test.", completionHours: 2, notes: "Under the sink.", costs: lines,
  });
  for (const amount of ["", "NaN", "Infinity", "-0.01", "1e3", "1.005"]) assert.equal(cost(amount), null, amount);
  for (const quantity of ["", "0", "1.5", "10001"]) assert.equal(cost("50", quantity), null, quantity);
  assert.equal(estimateTotal([null]), null);
  assert.match(validateEstimate({ ...details, inspection: "          " }, lines), /10 characters/);
  assert.match(validateEstimate({ ...details, completionHours: "1.5" }, lines), /completion time/);
  assert.match(validateEstimate(details, [{ ...lines[0], description: "" }]), /description/);
  assert.match(validateEstimate(details, [cost("10000000", "2")]), /exceeds/);
});

test("role and estimate state drive visible actions and payment labels", () => {
  const pendingTower = { canReview: true, status: "PENDING_TOWER_VERIFICATION" };
  const towerActions = decisionActions(pendingTower, ROLES.TOWER_REPRESENTATIVE);
  assert.deepEqual(towerActions.map(({ decision }) => decision), ["APPROVE", "REJECT", "RETURN"]);
  assert.ok(towerActions.slice(1).every(({ reason }) => reason));
  assert.deepEqual(decisionActions({ ...pendingTower, canReview: false }, ROLES.TOWER_REPRESENTATIVE), []);
  assert.deepEqual(decisionActions(pendingTower, ROLES.COMMUNITY_ADMIN), []);
  assert.deepEqual(decisionActions(pendingTower, ROLES.MAINTENANCE_WORKER), []);
  assert.deepEqual(decisionActions(pendingTower, ROLES.RESIDENT), []);
  const adminActions = decisionActions({ status: "PENDING_COMMUNITY_ADMIN_APPROVAL" }, ROLES.COMMUNITY_ADMIN);
  assert.deepEqual(adminActions.map(({ operation, decision }) => [operation, decision]), [["adminDecision", "APPROVE"], ["adminDecision", "REJECT"]]);
  assert.ok(adminActions[1].reason);
  assert.deepEqual(decisionActions({ status: "PENDING_COMMUNITY_ADMIN_APPROVAL", canApprovePayment: false }, ROLES.COMMUNITY_ADMIN),
    [adminActions[1]]);
  assert.deepEqual(decisionActions({ status: "APPROVED_FOR_PAYMENT", isEstimateSubmitter: true }, ROLES.COMMUNITY_ADMIN), []);
  const [payment] = decisionActions({ status: "APPROVED_FOR_PAYMENT" }, ROLES.COMMUNITY_ADMIN);
  assert.equal(payment.operation, "pay");
  assert.match(payment.description, /simulated payment/);
  assert.deepEqual(decisionActions({ status: "PAID" }, ROLES.COMMUNITY_ADMIN), []);
  assert.deepEqual(decisionActions({ status: "REJECTED_BY_ADMIN" }, ROLES.COMMUNITY_ADMIN), []);
  assert.match(estimateStatusLabel("PENDING_COMMUNITY_ADMIN_APPROVAL"), /Tower verified.*Awaiting payment approval/);
  assert.equal(estimateStatusLabel("PAID"), "Mock payment completed");
});
