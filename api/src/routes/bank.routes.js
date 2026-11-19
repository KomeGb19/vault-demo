import { Router } from "express";
import User from "../models/User.js";
import Council from "../models/Council.js";
import { requireAuth } from "../middleware/auth.js";
import { runPayoutCheck } from "../services/vault.service.js";

const router = Router();

// DemoBank asks VAULT: YES or NO? Only on YES does DemoBank move the (fake) money.
router.post("/withdraw", requireAuth, async (req, res, next) => {
  try {
    const { destination, amount } = req.body;
    const amt = Number(amount);
    if (!destination?.bank || !destination?.number || !(amt > 0)) {
      return res
        .status(400)
        .json({
          error:
            "destination (bank, number) and a positive amount are required",
        });
    }
    const council = await Council.findOne({ ownerId: req.user.id });
    if (!council)
      return res.status(400).json({ error: "Create a VAULT council first" });
    if (req.user.balance < amt)
      return res.status(400).json({ error: "Insufficient balance" });

    const check = await runPayoutCheck(council, destination, amt);
    if (check.verdict !== "YES") {
      return res.status(403).json({ ...check, balance: req.user.balance });
    }
    const updated = await User.findOneAndUpdate(
      { _id: req.user.id, balance: { $gte: amt } },
      { $inc: { balance: -amt } },
      { new: true },
    );
    if (!updated)
      return res.status(400).json({ error: "Insufficient balance" });
    res.json({ ...check, balance: updated.balance });
  } catch (e) {
    next(e);
  }
});

export default router;
