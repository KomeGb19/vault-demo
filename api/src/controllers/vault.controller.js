import mongoose from "mongoose";
import Council from "../models/Council.js";
import HomeChangeRequest from "../models/HomeChangeRequest.js";
import { createChange } from "../rules/vaultRules.js";
import { accountKey } from "../rules/vaultRules.js";
import { getNow } from "../services/clock.js";
import { signMemberToken } from "../middleware/memberAuth.js";
import {
  runPayoutCheck,
  refreshChange,
  serializeChange,
} from "../services/vault.service.js";

const isId = (id) => mongoose.isValidObjectId(id);

const councilView = (c) => ({
  id: c.id,
  members: c.members.map((m) => ({
    id: m.id,
    name: m.name,
    token: signMemberToken(c.id, m.id),
  })),
  homeAccount: c.homeAccount,
  tradeCount: c.tradeCount,
});

// POST /vault/create  (auth)
export async function createCouncil(req, res, next) {
  try {
    const { members, homeAccount } = req.body;
    if (
      !Array.isArray(members) ||
      members.length !== 5 ||
      members.some((m) => !String(m).trim())
    ) {
      return res
        .status(400)
        .json({ error: "members must be an array of exactly 5 names" });
    }
    if (!homeAccount?.bank || !homeAccount?.number) {
      return res
        .status(400)
        .json({ error: "homeAccount needs bank and number" });
    }
    if (await Council.findOne({ ownerId: req.user.id })) {
      return res.status(409).json({ error: "This user already has a council" });
    }
    const now = await getNow();
    const council = await Council.create({
      ownerId: req.user.id,
      members: members.map((name) => ({ name: String(name) })),
      homeAccount: { ...homeAccount, lockedAt: now }, // first Home Account is set instantly
    });
    res.status(201).json(councilView(council));
  } catch (e) {
    next(e);
  }
}

// GET /vault/council/mine  (auth)
export async function getMyCouncil(req, res, next) {
  try {
    const council = await Council.findOne({ ownerId: req.user.id });
    if (!council) return res.status(404).json({ error: "No council yet" });
    const latest = await HomeChangeRequest.findOne({
      councilId: council.id,
    }).sort({ createdAt: -1 });
    if (latest) await refreshChange(latest);
    const fresh = await Council.findById(council.id); // home account may have just changed
    res.json({
      council: councilView(fresh),
      latestChange: latest ? await serializeChange(latest) : null,
    });
  } catch (e) {
    next(e);
  }
}

// POST /vault/request  type = "payout" | "change_home"
export async function submitRequest(req, res, next) {
  try {
    const { type, councilId } = req.body;
    const council = isId(councilId) ? await Council.findById(councilId) : null;
    if (!council) return res.status(404).json({ error: "Council not found" });

    if (type === "payout") {
      const { destination, amount } = req.body;
      if (!destination?.bank || !destination?.number) {
        return res
          .status(400)
          .json({ error: "destination needs bank and number" });
      }
      return res.json(
        await runPayoutCheck(council, destination, Number(amount) || 0),
      );
    }

    if (type === "change_home") {
      const { newAccount, requestedBy } = req.body;
      if (!newAccount?.bank || !newAccount?.number) {
        return res
          .status(400)
          .json({ error: "newAccount needs bank and number" });
      }
      if (accountKey(newAccount) === accountKey(council.homeAccount)) {
        return res
          .status(400)
          .json({ error: "That is already the Home Account" });
      }
      const open = await HomeChangeRequest.findOne({
        councilId: council.id,
        status: "BLOCKED",
      });
      if (open) {
        await refreshChange(open);
        if (open.status === "BLOCKED") {
          return res
            .status(409)
            .json({
              error: "A change request is already open",
              request: await serializeChange(open),
            });
        }
      }
      const now = await getNow();
      const c = createChange(now);
      const doc = await HomeChangeRequest.create({
        councilId: council.id,
        newAccount,
        requestedBy: requestedBy || "Staff",
        requestedAt: now,
        requiredApprovals: c.requiredApprovals,
        eligibleAt: c.eligibleAt,
      });
      return res.status(201).json(await serializeChange(doc));
    }

    res.status(400).json({ error: 'type must be "payout" or "change_home"' });
  } catch (e) {
    next(e);
  }
}

// GET /vault/request/:id
export async function getRequest(req, res, next) {
  try {
    if (!isId(req.params.id))
      return res.status(400).json({ error: "Invalid request id" });
    const request = await HomeChangeRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: "Request not found" });
    await refreshChange(request);
    res.json(await serializeChange(request));
  } catch (e) {
    next(e);
  }
}

// POST /vault/approve and /vault/veto
export const vote = (kind) => async (req, res, next) => {
  try {
    const { requestId, memberId } = req.body;
    if (!isId(requestId) || !isId(memberId)) {
      return res
        .status(400)
        .json({ error: "requestId and memberId are required" });
    }
    const request = await HomeChangeRequest.findById(requestId);
    if (!request) return res.status(404).json({ error: "Request not found" });

    await refreshChange(request);
    if (request.status !== "BLOCKED") {
      return res
        .status(409)
        .json({
          error: `Request is already ${request.status}`,
          request: await serializeChange(request),
        });
    }
    const council = await Council.findById(request.councilId);
    if (!council.members.id(memberId))
      return res.status(403).json({ error: "Not a member of this council" });

    const alreadyVoted = [...request.approvals, ...request.vetoes].some((id) =>
      id.equals(memberId),
    );
    if (alreadyVoted)
      return res.status(409).json({ error: "This member has already voted" });

    request[kind === "approve" ? "approvals" : "vetoes"].push(memberId);
    await refreshChange(request);
    res.json(await serializeChange(request));
  } catch (e) {
    next(e);
  }
};
