import { ROLES } from "../../../constants/roles.js";

// Transitions the backend allows the responsible Tower Representative to perform:
// SUBMITTED → UNDER_REVIEW   PATCH /complaints/:id/status
// UNDER_REVIEW → ASSIGNED    POST  /complaints/:id/assign
// PENDING_VERIFICATION → RESOLVED  PATCH /complaints/:id/verify-resolution
// REVIEWED → CLOSED          PATCH /complaints/:id/status
// ASSIGNED/IN_PROGRESS belong to the worker; RESOLVED → REVIEWED belongs to the resident.
const AUTHORITY_ACTIONS = Object.freeze({
  SUBMITTED: { action: "review", label: "Start review" },
  UNDER_REVIEW: { action: "assign", label: "Assign worker" },
  PENDING_VERIFICATION: { action: "verify", label: "Verify resolution" },
  REVIEWED: { action: "close", label: "Close complaint" },
});

const GUIDANCE = Object.freeze({
  SUBMITTED: "Review this complaint and move it to Under Review before assigning a maintenance worker.",
  UNDER_REVIEW: "This complaint is ready for assignment to an eligible maintenance worker.",
  ASSIGNED: "A maintenance worker has been assigned and can start work from their portal.",
  IN_PROGRESS: "The assigned maintenance worker is progressing this work.",
  PENDING_VERIFICATION: "The worker submitted resolution proof. Review the proof and verify the resolution with a work-quality rating.",
  RESOLVED: "The resolution is verified. The resident can now submit a review.",
  REVIEWED: "The resident review is available. You may now close this complaint.",
  CLOSED: "This complaint has completed its lifecycle.",
});

// UI convenience only: the backend independently enforces responsible-authority checks.
export function isResponsibleAuthority(complaint, user) {
  return Boolean(
    user?.id &&
      complaint?.responsibleRole === ROLES.TOWER_REPRESENTATIVE &&
      complaint.responsibleUserId === user.id,
  );
}

export function nextAuthorityAction(complaint, user) {
  if (!isResponsibleAuthority(complaint, user)) return null;
  return AUTHORITY_ACTIONS[complaint.status] || null;
}

export function lifecycleGuidance(status) {
  return GUIDANCE[status] || "Current complaint lifecycle status.";
}
