const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type Account = { bank: string; number: string; name?: string; lockedAt?: string };
export type Member = { id: string; name: string; token: string };
export type Council = {
  id: string;
  members: Member[];
  homeAccount: Account;
  tradeCount: number;
};
export type User = { id: string; name: string; email: string; balance: number };

export type PayoutView = {
  payoutId: string;
  toAccount: Account;
  amount: number;
  accountType: "HOME" | "NEW";
  status: "BLOCKED" | "APPROVED" | "REJECTED";
  reason: string;
  approvalsRequired: number;
  approvalsReceived: number;
  progress: string | null;
  rejections: number;
  delayHours: number;
  eligibleAt: string;
  hoursRemaining: number;
};
export type AuditEvent = {
  event: string;
  memberId: string | null;
  name: string;
  channel: string;
  detail: string;
  at: string;
  realAt: string;
};
export type Audit = PayoutView & { history: AuditEvent[] };

export const getToken = () =>
  typeof window === "undefined" ? null : localStorage.getItem("vault_token");
export const setToken = (t: string | null) =>
  t ? localStorage.setItem("vault_token", t) : localStorage.removeItem("vault_token");

// tokenOverride lets us act as a council member (approve/reject) instead of the logged-in user.
export async function api<T>(
  method: string,
  path: string,
  body?: unknown,
  tokenOverride?: string
): Promise<T> {
  const token = tokenOverride ?? getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}