import { Router } from "express";
import User from "../models/User.js";
import Council from "../models/Council.js";
import HomeChangeRequest from "../models/HomeChangeRequest.js";
import Payout from "../models/Payout.js";
import CheckLog from "../models/CheckLog.js";
import { requireAuth } from "../middleware/auth.js";
import { getNow, getOffset, advance, resetClock } from "../services/clock.js";

const router = Router();

router.get("/clock", async (req, res, next) => {
  try {
    res.json({ now: await getNow(), offsetMs: await getOffset() });
  } catch (e) {
    next(e);
  }
});

// "Simulate 1 Hour Passed" = hours: 1.  "+24h" shortcut = hours: 24.
router.post("/advance", async (req, res, next) => {
  try {
    const hours = Number(req.body?.hours ?? 1);
    if (![1, 24].includes(hours))
      return res.status(400).json({ error: "hours must be 1 or 24" });
    await advance(hours);
    res.json({ now: await getNow() });
  } catch (e) {
    next(e);
  }
});

// Wipes the caller's council, requests and logs, resets the balance and the clock. For re-recording the demo.
router.post("/reset", requireAuth, async (req, res, next) => {
  try {
    const council = await Council.findOne({ ownerId: req.user.id });
    if (council) {
      await HomeChangeRequest.deleteMany({ councilId: council.id });
      await CheckLog.deleteMany({ councilId: council.id });
      await council.deleteOne();
      await Payout.deleteMany({ councilId: council.id });
    }
    await User.updateOne({ _id: req.user.id }, { balance: 1_000_000 });
    await resetClock();
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
