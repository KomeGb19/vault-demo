import mongoose from "mongoose";
import Council from "../models/Council.js";
import Payout from "../models/Payout.js";
import {
  RULES,
  checkPayout,
  createChange,
  evaluateChange,
} from "../rules/vaultRules.js";
import { getNow } from "../services/clock.js";

const isId = (id) => mongoose.isValidObjectId(id);
const HOUR = 3600 * 1000;

// Re-evaluate a BLOCKED payout against the demo clock. Terminal states are final.
async function refresh(payout, force = false) {
  let changed = false;
  if (payout.status === "BLOCKED") {
    const now = await getNow();
    const { status, reason } = evaluateChange(
      {
        approvals: payout.approvals.length,
        vetoes: payout.rejections.length,
        requiredApprovals: payout.requiredApprovals,
        eligibleAt: payout.eligibleAt,
      },
      now,
    );
    if (status !== payout.status || reason !== payout.reason) {
      changed = true;
      payout.status = status;
      payout.reason = reason;
      if (status === "APPROVED") {
        payout.history.push({
          event: "PAYOUT_APPROVED",
          byName: "VAULT",
          channel: "system",
          at: now,
          detail: "3 approvals received and 24h delay completed",
        });
      } else if (status === "REJECTED") {
        payout.history.push({
          event: "PAYOUT_REJECTED",
          byName: "VAULT",
          channel: "system",
          at: now,
          detail: "Rejected by a council member. Final, cannot be reversed",
        });
      }
    }
  }
  if (changed || force) await payout.save();
  return payout;
}

async function view(p) {
  const now = await getNow();
  const required = p.requiredApprovals;
  return {
    payoutId: p.id,
    councilId: p.councilId,
    toAccount: {
      bank: p.toAccount.bank,
      number: p.toAccount.number,
      name: p.toAccount.name,
    },
    amount: p.amount,
    accountType: p.accountType,
    status: p.status,
    reason: p.reason,
    approvalsRequired: required,
    approvalsReceived: p.approvals.length,
    progress: required ? `${p.approvals.length} of ${required}` : null,
    rejections: p.rejections.length,
    delayHours: p.delayHours,
    eligibleAt: p.eligibleAt,
    hoursRemaining:
      p.status === "BLOCKED"
        ? Math.max(
            0,
            Math.ceil((p.eligibleAt.getTime() - now.getTime()) / HOUR),
          )
        : 0,
  };
}

// POST /api/payout/check
export async function check(req, res, next) {
  try {
    const { toAccount, amount } = req.body;
    if (!toAccount?.bank || !toAccount?.number) {
      return res.status(400).json({ error: "toAccount needs bank and number" });
    }
    const council = await Council.findOne({ ownerId: req.user.id });
    if (!council) {
      return res
        .status(400)
        .json({
          error: "No council found. Create one with POST /vault/create first",
        });
    }

    const now = await getNow();
    const isHome =
      checkPayout({ homeAccount: council.homeAccount, destination: toAccount })
        .verdict === "YES";
    const change = isHome ? null : createChange(now);

    const payout = await Payout.create({
      councilId: council.id,
      toAccount: {
        bank: toAccount.bank,
        number: toAccount.number,
        name: toAccount.name || "",
      },
      amount: Number(amount) || 0,
      accountType: isHome ? "HOME" : "NEW",
      status: isHome ? "APPROVED" : "BLOCKED",
      reason: isHome ? "HOME_ACCOUNT" : "NEED_APPROVALS",
      requiredApprovals: isHome ? 0 : change.requiredApprovals,
      delayHours: isHome ? 0 : RULES.CHANGE_DELAY_MS / HOUR,
      eligibleAt: isHome ? now : change.eligibleAt,
      history: [
        {
          event: "PAYOUT_CHECKED",
          byName: "VAULT",
          channel: "api",
          at: now,
          detail: isHome
            ? "Destination is the Home Account. Auto-approved, 0 delay"
            : "Destination is a NEW account. Blocked: needs 3 approvals + 24h delay",
        },
      ],
    });
    res.json(await view(payout));
  } catch (e) {
    next(e);
  }
}

// POST /api/payout/approve   body: { payoutId, decision: "APPROVE" | "REJECT", channel? }
export async function decide(req, res, next) {
  try {
    const { payoutId, decision, channel } = req.body;
    if (!isId(payoutId))
      return res.status(400).json({ error: "payoutId is required" });
    if (!["APPROVE", "REJECT"].includes(decision)) {
      return res
        .status(400)
        .json({ error: 'decision must be "APPROVE" or "REJECT"' });
    }

    const payout = await Payout.findById(payoutId);
    if (!payout) return res.status(404).json({ error: "Payout not found" });
    if (String(payout.councilId) !== String(req.council.id)) {
      return res
        .status(403)
        .json({ error: "This payout belongs to another council" });
    }

    await refresh(payout);
    if (payout.status !== "BLOCKED") {
      return res
        .status(409)
        .json({
          error: `Payout is already ${payout.status}`,
          payout: await view(payout),
        });
    }

    const memberId = req.member._id;
    const alreadyVoted = [...payout.approvals, ...payout.rejections].some(
      (id) => id.equals(memberId),
    );
    if (alreadyVoted) {
      return res
        .status(409)
        .json({ error: "This member has already voted on this payout" });
    }
    if (
      decision === "APPROVE" &&
      payout.approvals.length >= payout.requiredApprovals
    ) {
      return res.status(409).json({
        error: "Already has enough approvals. Waiting for the delay",
        payout: await view(payout),
      });
    }

    const now = await getNow();
    const via =
      String(channel || "api")
        .trim()
        .slice(0, 30) || "api";
    if (decision === "APPROVE") payout.approvals.push(memberId);
    else payout.rejections.push(memberId);

    payout.history.push({
      event: decision === "APPROVE" ? "MEMBER_APPROVED" : "MEMBER_REJECTED",
      by: memberId,
      byName: req.member.name,
      channel: via,
      at: now,
      detail:
        decision === "APPROVE"
          ? `Approval ${payout.approvals.length} of ${payout.requiredApprovals}`
          : "Rejection. Payout is rejected permanently",
    });
    await refresh(payout, true);

    res.json({
      ...(await view(payout)),
      vote: { decision, by: req.member.name, channel: via },
    });
  } catch (e) {
    next(e);
  }
}

// GET /api/audit/:id
export async function audit(req, res, next) {
  try {
    if (!isId(req.params.id))
      return res.status(400).json({ error: "Invalid payout id" });
    const payout = await Payout.findById(req.params.id);
    if (!payout) return res.status(404).json({ error: "Payout not found" });
    if (String(payout.councilId) !== String(req.councilId)) {
      return res
        .status(403)
        .json({ error: "This payout belongs to another council" });
    }
    await refresh(payout);
    res.json({
      ...(await view(payout)),
      history: payout.history.map((h) => ({
        event: h.event,
        memberId: h.by ?? null,
        name: h.byName,
        channel: h.channel,
        detail: h.detail,
        at: h.at,
        realAt: h.realAt,
      })),
    });
  } catch (e) {
    next(e);
  }
}
