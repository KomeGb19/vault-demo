import Council from "../models/Council.js";
import CheckLog from "../models/CheckLog.js";
import { checkPayout, evaluateChange } from "../rules/vaultRules.js";
import { getNow } from "./clock.js";

// VAULT only says YES or NO. It never touches money.
export async function runPayoutCheck(council, destination, amount = 0) {
  const t0 = performance.now();
  const result = checkPayout({ homeAccount: council.homeAccount, destination });
  const ms = Number((performance.now() - t0).toFixed(3));

  if (result.verdict === "YES") {
    await Council.updateOne({ _id: council._id }, { $inc: { tradeCount: 1 } });
    council.tradeCount += 1;
  }
  await CheckLog.create({
    councilId: council._id,
    destination: { bank: destination.bank, number: destination.number },
    amount,
    ...result,
    ms,
  });
  return { ...result, decidedInMs: ms };
}

// Re-evaluates an open change request against the demo clock.
// When it becomes APPROVED, the Home Account is switched (once).
export async function refreshChange(request) {
  if (request.status !== "BLOCKED") return request;
  const now = await getNow();
  const { status, reason } = evaluateChange(
    {
      approvals: request.approvals.length,
      vetoes: request.vetoes.length,
      requiredApprovals: request.requiredApprovals,
      eligibleAt: request.eligibleAt,
    },
    now,
  );
  request.status = status;
  request.reason = reason;

  if (status === "APPROVED") {
    request.appliedAt = now;
    await Council.updateOne(
      { _id: request.councilId },
      {
        $set: {
          homeAccount: {
            bank: request.newAccount.bank,
            number: request.newAccount.number,
            name: request.newAccount.name,
            lockedAt: now,
          },
        },
      },
    );
  }
  await request.save();
  return request;
}

export async function serializeChange(r) {
  const now = await getNow();
  return {
    id: r.id,
    councilId: r.councilId,
    newAccount: {
      bank: r.newAccount.bank,
      number: r.newAccount.number,
      name: r.newAccount.name,
    },
    requestedBy: r.requestedBy,
    status: r.status,
    reason: r.reason,
    approvals: r.approvals.length,
    vetoes: r.vetoes.length,
    requiredApprovals: r.requiredApprovals,
    eligibleAt: r.eligibleAt,
    hoursRemaining: Math.max(
      0,
      Math.ceil((r.eligibleAt.getTime() - now.getTime()) / 3600000),
    ),
    now,
  };
}
