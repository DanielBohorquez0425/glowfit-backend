import { Router } from "express";
import {
  sendInvitation,
  acceptInvitation,
  getInvitationsByUserEmail,
} from "../controllers/invitationController.js";
import { authenticateToken, requireGlobalRole } from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/user", authenticateToken, getInvitationsByUserEmail);
router.post("/send", authenticateToken, requireGlobalRole("ADMIN", "SUPERADMIN"), sendInvitation);
router.patch("/:id/accepted", authenticateToken, acceptInvitation);

export default router;
