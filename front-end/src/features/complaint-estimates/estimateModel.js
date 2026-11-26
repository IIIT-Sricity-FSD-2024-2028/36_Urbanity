import { ROLES } from "../../constants/roles.js";

export const MAX_ESTIMATE_PAISE = 1_000_000_000;

export const categories = {
  MATERIAL: "Materials",
  LABOUR: "Labour",
  ADDITIONAL: "Additional costs",
};

const statusLabels = {
  CANCELLED: "Estimate cancelled · A new estimate is required",
  AWAITING_WORKER_ESTIMATE: "Worker preparing an estimate",
  PENDING_TOWER_VERIFICATION: "Estimate awaiting tower verification",
  RETURNED_FOR_REVISION: "Estimate returned for revision",
  REJECTED_BY_TOWER: "Estimate rejected by tower representative",
  PENDING_COMMUNITY_ADMIN_APPROVAL: "Tower verified · Awaiting payment approval",
  REJECTED_BY_ADMIN: "Payment rejected · Estimate can be revised",
  APPROVED_FOR_PAYMENT: "Payment approved · Awaiting mock payment",
  PAID: "Mock payment completed",
};

export function estimateStatusLabel(status) {
  return statusLabels[status] || "No estimate submitted";
}

const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
export const formatEstimateAmount = (paise) => rupees.format(paise / 100);
export const formatEstimateDate = (value) => new Date(value).toLocaleString("en-IN");

function toPaise(value) {
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const paise = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return paise <= MAX_ESTIMATE_PAISE ? paise : null;
}

export function costLine({ category, description, quantity, unitPrice }) {
  const units = Number(quantity);
  const unitPricePaise = toPaise(unitPrice);
  if (!/^\d+$/.test(quantity) || !Number.isInteger(units) || units < 1 || units > 10_000 || unitPricePaise === null) return null;
  return { category, description: description.trim(), quantity: units, unitPricePaise };
}

export function estimateTotal(costs) {
  if (costs.some((entry) => !entry)) return null;
  return costs.reduce((sum, entry) => sum + entry.quantity * entry.unitPricePaise, 0);
}

export function validateEstimate({ inspection, proposedResolution, completionHours, notes }, costs) {
  if ([inspection, proposedResolution].some((value) => value.trim().length < 10)) {
    return "Enter at least 10 characters for the inspection and proposed resolution.";
  }
  if (!notes.trim()) return "Enter supporting notes.";
  const hours = Number(completionHours);
  if (!Number.isInteger(hours) || hours < 1 || hours > 8760) return "Enter a completion time between 1 and 8,760 hours.";
  if (!costs.length || costs.some((entry) => !entry?.description)) return "Provide a description, valid quantity and price for each cost.";
  if (estimateTotal(costs) > MAX_ESTIMATE_PAISE) return "The total estimate exceeds the allowed amount.";
  return { inspection: inspection.trim(), proposedResolution: proposedResolution.trim(), completionHours: hours, notes: notes.trim(), costs };
}

export function decisionActions(record, role) {
  if (record.isEstimateSubmitter) return [];
  if (role === ROLES.TOWER_REPRESENTATIVE && record.canCancel) {
    return [{ operation: "cancel", label: "Cancel estimate and release worker", reason: true, success: "Estimate cancelled. Assign a replacement worker to request a fresh estimate." }];
  }
  if (role === ROLES.TOWER_REPRESENTATIVE && record.canReview) {
    return [
      { operation: "towerDecision", decision: "APPROVE", label: "Approve estimate", description: "Send the estimate to the Community Admin for payment approval.", success: "Estimate verified and sent for payment approval." },
      { operation: "towerDecision", decision: "REJECT", label: "Reject estimate", reason: true, success: "Estimate rejected." },
      { operation: "towerDecision", decision: "RETURN", label: "Return for revision", reason: true, success: "Estimate returned to the worker." },
    ];
  }
  if (role !== ROLES.COMMUNITY_ADMIN) return [];
  if (record.status === "PENDING_COMMUNITY_ADMIN_APPROVAL") {
    const reject = { operation: "adminDecision", decision: "REJECT", label: "Reject payment", reason: true, success: "Payment rejected." };
    if (record.canApprovePayment === false) return [reject];
    return [
      { operation: "adminDecision", decision: "APPROVE", label: "Approve payment", description: "Approval makes the estimate eligible for a separate mock payment.", success: "Mock payment approved for execution." },
      reject,
    ];
  }
  if (record.status === "APPROVED_FOR_PAYMENT") {
    return [{ operation: "pay", label: "Execute mock payment", description: "This simulated payment creates a mock receipt. No money will be transferred." }];
  }
  return [];
}
