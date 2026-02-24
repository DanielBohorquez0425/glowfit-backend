import { Router } from "express";
import * as xpController from "../controllers/xpController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";

const router = Router();

router.post("/award", authenticateToken, xpController.awardXp);

router.get("/history", authenticateToken, xpController.getXpHistory);

router.get("/stats", authenticateToken, xpController.getUserStats);

router.get("/config", authenticateToken, xpController.getXpConfig);

export default router;
