import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  createCouncil,
  getMyCouncil,
  submitRequest,
  getRequest,
  vote,
} from "../controllers/vault.controller.js";

const router = Router();
router.post("/create", requireAuth, createCouncil);
router.get("/council/mine", requireAuth, getMyCouncil);
router.post("/request", submitRequest);
router.get("/request/:id", getRequest);
router.post("/approve", vote("approve"));
router.post("/veto", vote("veto"));

export default router;
