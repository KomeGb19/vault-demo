import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  requireMember,
  requireCouncilAccess,
} from "../middleware/memberAuth.js";
import { check, decide, audit } from "../controllers/payout.controller.js";

const router = Router();
router.post("/payout/check", requireAuth, check);
router.post("/payout/approve", requireMember, decide);
router.get("/audit/:id", requireCouncilAccess, audit);

export default router;
