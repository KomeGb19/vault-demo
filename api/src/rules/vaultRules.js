export const RULES = {
  CHANGE_APPROVALS_REQUIRED: 3,
  CHANGE_DELAY_MS: 24 * 60 * 60 * 1000,
};

export const accountKey = (a) =>
  `${String(a.bank).trim().toLowerCase()}:${String(a.number).trim()}`;

// Payout check: is the destination the Home Account?
export function checkPayout({ homeAccount, destination }) {
  if (!homeAccount)
    return { verdict: "NO", status: "BLOCKED", reason: "NO_HOME_ACCOUNT" };
  if (accountKey(homeAccount) === accountKey(destination)) {
    return { verdict: "YES", status: "APPROVED", reason: "HOME_ACCOUNT" };
  }
  return { verdict: "NO", status: "BLOCKED", reason: "NOT_HOME_ACCOUNT" };
}

// Called once, when a Home Account change is requested
export function createChange(now) {
  return {
    requiredApprovals: RULES.CHANGE_APPROVALS_REQUIRED,
    eligibleAt: new Date(now.getTime() + RULES.CHANGE_DELAY_MS),
  };
}

// Called every time a change request is read, voted on, or the clock moves
export function evaluateChange(c, now) {
  if (c.vetoes > 0) return { status: "REJECTED", reason: "VETOED" };
  if (c.approvals < c.requiredApprovals)
    return { status: "BLOCKED", reason: "NEED_APPROVALS" };
  if (now.getTime() < c.eligibleAt.getTime())
    return { status: "BLOCKED", reason: "WAITING_24H" };
  return { status: "APPROVED", reason: "UNLOCKED" };
}
