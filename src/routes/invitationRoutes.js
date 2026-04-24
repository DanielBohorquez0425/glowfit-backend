import { Router } from "express";
import { sendInvitation } from "../controllers/invitationController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";

const router = Router();

router.post("/send", authenticateToken, sendInvitation);

export default router;
