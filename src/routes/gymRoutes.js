import { Router } from "express";
import { getMembersByGymId } from "../controllers/invitationController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/:gymId/members", authenticateToken, getMembersByGymId);

export default router;
