import { Router } from "express";
import { listAllGyms, listGymUsers } from "../controllers/gymController.js";
import { authenticateToken, requireGymRole } from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/", authenticateToken, listAllGyms);
router.get("/:gymId/users", authenticateToken, requireGymRole("GYM_OWNER", "GYM_ADMIN"), listGymUsers);

export default router;
