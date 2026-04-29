import { Router } from "express";
import {
  sendInvitation,
  acceptInvitation,
} from "../controllers/invitationController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";

const router = Router();

router.post("/send", authenticateToken, sendInvitation);
router.patch("/:id/accepted", authenticateToken, acceptInvitation);

export default router;
