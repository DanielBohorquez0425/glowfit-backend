import { Router } from "express";
import {
  listClasses,
  createClass,
  updateClass,
  deleteClass,
} from "../controllers/gymClassController.js";
import {
  authenticateToken,
  requireGymRole,
} from "../middlewares/authMiddleware.js";

const router = Router();

router.get(
  "/:gymId/classes",
  authenticateToken,
  requireGymRole("GYM_OWNER", "GYM_ADMIN"),
  listClasses,
);
router.post(
  "/:gymId/classes",
  authenticateToken,
  requireGymRole("GYM_OWNER", "GYM_ADMIN"),
  createClass,
);
router.patch(
  "/:gymId/classes/:classId",
  authenticateToken,
  requireGymRole("GYM_OWNER", "GYM_ADMIN"),
  updateClass,
);
router.delete(
  "/:gymId/classes/:classId",
  authenticateToken,
  requireGymRole("GYM_OWNER", "GYM_ADMIN"),
  deleteClass,
);

export default router;
