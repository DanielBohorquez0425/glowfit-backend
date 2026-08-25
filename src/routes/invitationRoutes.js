import { Router } from "express";
import {
  sendInvitation,
  acceptInvitation,
  getInvitationsByUserEmail,
  listGymInvitations,
} from "../controllers/invitationController.js";
import { authenticateToken, requireGlobalRole, requireGymRole } from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/user", authenticateToken, getInvitationsByUserEmail);
router.get("/gym/:gymId", authenticateToken, requireGymRole("GYM_ADMIN"), listGymInvitations);
router.post("/send", authenticateToken, requireGlobalRole("ADMIN", "SUPERADMIN"), sendInvitation);
router.patch("/:id/accepted", authenticateToken, acceptInvitation);

export default router;
