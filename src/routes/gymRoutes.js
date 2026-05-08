import { Router } from "express";
import { getMembersByGymId } from "../controllers/invitationController.js";
import { listAllGyms } from "../controllers/gymController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/", authenticateToken, listAllGyms);
router.get("/:gymId/members", authenticateToken, getMembersByGymId);

export default router;
