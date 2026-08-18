import { Router } from "express";
import { listAllGyms, listGymUsers, listTrainerMembers, getNewMembersStats, updateMemberRoles } from "../controllers/gymController.js";
import { authenticateToken, requireGymRole } from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/", authenticateToken, listAllGyms);
router.get("/:gymId/users", authenticateToken, requireGymRole("GYM_ADMIN"), listGymUsers);
router.get("/:gymId/trainer/members", authenticateToken, requireGymRole("TRAINER"), listTrainerMembers);
router.get("/:gymId/dashboard/new-members", authenticateToken, requireGymRole("GYM_ADMIN"), getNewMembersStats);
router.patch("/:gymId/members/:userId/roles", authenticateToken, requireGymRole("GYM_ADMIN"), updateMemberRoles);

export default router;
