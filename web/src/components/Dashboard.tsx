"use client";

import { useCallback, useEffect, useState } from "react";
import {
  api,
  type Account,
  type Audit,
  type Council,
  type PayoutView,
  type User,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const NEW_ACCOUNT: Account = {
  bank: "OPay",
  number: "9876543210",
  name: "Chidi Unknown",
};
const CHANNELS = ["app", "sms", "email", "whatsapp"];

const REASONS: Record<string, string> = {
  HOME_ACCOUNT:
    "Destination is the Home Account. Auto-approved, no council, 0 delay",
  NEED_APPROVALS:
    "Destination is a NEW account. Needs 3 council approvals + 24h delay",
  WAITING_24H: "3 approvals reached. Waiting for the 24-hour delay",
  UNLOCKED: "Approved: 3 approvals and 24h delay completed",
  VETOED: "Rejected by a council member. Final, cannot be reversed",
};
const EVENTS: Record<string, string> = {
  PAYOUT_CHECKED: "Checked",
  MEMBER_APPROVED: "Approved",
  MEMBER_REJECTED: "Rejected",
  PAYOUT_APPROVED: "Released",
  PAYOUT_REJECTED: "Rejected (final)",
};

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;
const lagos = (iso: string) =>
  new Date(iso).toLocaleString("en-NG", { timeZone: "Africa/Lagos" });

export default function Dashboard({
  onLogout,
  onReset,
}: {
  onLogout: () => void;
  onReset: () => void;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [council, setCouncil] = useState<Council | null>(null);
  const [payoutId, setPayoutId] = useState<string | null>(null);
  const [payout, setPayout] = useState<Audit | null>(null);
  const [now, setNow] = useState("");
  const [actingAs, setActingAs] = useState("");
  const [channel, setChannel] = useState("app");
  const [amount, setAmount] = useState("200000");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async (id: string | null) => {
    const [me, mine, clock] = await Promise.all([
      api<{ user: User }>("GET", "/auth/me"),
      api<{ council: Council }>("GET", "/vault/council/mine"),
      api<{ now: string }>("GET", "/demo/clock"),
    ]);
    setUser(me.user);
    setCouncil(mine.council);
    setNow(clock.now);
    setActingAs((cur) => cur || mine.council.members[0]?.id || "");
    if (id) setPayout(await api<Audit>("GET", `/api/audit/${id}`));
  }, []);

  useEffect(() => {
    refresh(null).catch((e: Error) => setError(e.message));
  }, [refresh]);

  // Runs an action, then reloads everything. fn returns the payout id to display.
  async function act(fn: () => Promise<string | null>) {
    setBusy(true);
    setError("");
    try {
      const id = await fn();
      setPayoutId(id);
      await refresh(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const sendPayout = (dest: Account) =>
    act(async () => {
      const r = await api<PayoutView>("POST", "/api/payout/check", {
        toAccount: dest,
        amount: Number(amount),
      });
      return r.payoutId;
    });

  const decide = (decision: "APPROVE" | "REJECT") =>
    act(async () => {
      const member = council?.members.find((m) => m.id === actingAs);
      if (!member || !payoutId) throw new Error("Send a payout first");
      await api(
        "POST",
        "/api/payout/approve",
        { payoutId, decision, channel },
        member.token,
      );
      return payoutId;
    });

  const demo = (path: string, body: unknown) =>
    act(async () => {
      await api("POST", path, body);
      return payoutId;
    });

  async function resetDemo() {
    setBusy(true);
    try {
      await api("POST", "/demo/reset");
      onReset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
      setBusy(false);
    }
  }

  if (!council || !user) return <p>{error || "Loading..."}</p>;

  const bar =
    payout?.status === "APPROVED"
      ? "bg-green-600"
      : payout?.status === "REJECTED"
        ? "bg-red-900"
        : "bg-red-600";
  const canSend = Number(amount) > 0 && !busy;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <b>{user.name}</b>
        <div className="flex items-center gap-3">
          <span>
            Demo time: <b>{now && lagos(now)}</b>
          </span>
          <button className="underline" onClick={onLogout}>
            Log out
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Demo controls */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 pt-6">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => demo("/demo/advance", { hours: 1 })}
          >
            Simulate 1 Hour Passed
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => demo("/demo/advance", { hours: 24 })}
          >
            +24h
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => demo("/demo/set-time", { time: "02:14" })}
          >
            Set clock to 2:14 AM
          </Button>
          <Button variant="ghost" disabled={busy} onClick={resetDemo}>
            Reset demo
          </Button>
          <div className="ml-auto flex items-center gap-2 text-sm">
            Amount ₦
            <Input
              className="w-32"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Two destinations */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="bg-blue-200">
          <CardHeader>
            <CardTitle className="text-sm tracking-wide">
              HOME ACCOUNT · LOCKED
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-lg font-semibold">
                {council.homeAccount.name}
              </p>
              <p>
                {council.homeAccount.number} · {council.homeAccount.bank}
              </p>
            </div>
            <Button
              className="w-full"
              disabled={!canSend}
              onClick={() => sendPayout(council.homeAccount)}
            >
              Send payout to Home Account
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-lime-100">
          <CardHeader>
            <CardTitle className="text-sm tracking-wide">NEW ACCOUNT</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-lg font-semibold">{NEW_ACCOUNT.name}</p>
              <p>
                {NEW_ACCOUNT.number} · {NEW_ACCOUNT.bank}
              </p>
            </div>
            <Button
               
              className="w-full bg-lime-500"
              disabled={!canSend}
              onClick={() => sendPayout(NEW_ACCOUNT)}
            >
              Send payout to this account
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* VAULT's answer */}
      {payout && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Payout of {naira(payout.amount)} to{" "}
              {payout.toAccount.name || payout.toAccount.bank} ·{" "}
              {payout.toAccount.number} · {payout.toAccount.bank}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={`rounded p-3 text-white ${bar}`}>
              <p className="text-lg font-bold">Status: {payout.status}</p>
              <p>
                Approvals:{" "}
                {payout.approvalsRequired
                  ? `${payout.approvalsReceived}/${payout.approvalsRequired}`
                  : "not needed (0 delay)"}
              </p>
              {payout.status === "BLOCKED" && (
                <p>24h delay: {payout.hoursRemaining}h left</p>
              )}
              <p className="mt-1 text-sm">
                {REASONS[payout.reason] ?? payout.reason}
              </p>
            </div>

            {payout.status === "BLOCKED" && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm">Council member:</span>
                <select
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={actingAs}
                  onChange={(e) => setActingAs(e.target.value)}
                >
                  {council.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <span className="text-sm">via</span>
                <select
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                >
                  {CHANNELS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <Button disabled={busy} onClick={() => decide("APPROVE")}>
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={() => decide("REJECT")}
                >
                  Reject
                </Button>
              </div>
            )}

            <div>
              <p className="mb-2 text-sm font-semibold">Audit trail</p>
              <ol className="space-y-2 text-sm">
                {payout.history.map((h, i) => (
                  <li
                    key={i}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b pb-2"
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {lagos(h.at)}
                    </span>
                    <b>{EVENTS[h.event] ?? h.event}</b>
                    <span>{h.name}</span>
                    <span className="rounded bg-muted px-1.5 text-xs">
                      via {h.channel}
                    </span>
                    <span className="text-muted-foreground">{h.detail}</span>
                  </li>
                ))}
              </ol>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
