import { Router } from "express";
import {
  listClasses,
  listTodayClasses,
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
  "/:gymId/classes/today",
  authenticateToken,
  requireGymRole("GYM_ADMIN", "TRAINER", "MEMBER"),
  listTodayClasses,
);
router.get(
  "/:gymId/classes",
  authenticateToken,
  requireGymRole("GYM_ADMIN"),
  listClasses,
);
router.post(
  "/:gymId/classes",
  authenticateToken,
  requireGymRole("GYM_ADMIN"),
  createClass,
);
router.patch(
  "/:gymId/classes/:classId",
  authenticateToken,
  requireGymRole("GYM_ADMIN"),
  updateClass,
);
router.delete(
  "/:gymId/classes/:classId",
  authenticateToken,
  requireGymRole("GYM_ADMIN"),
  deleteClass,
);

export default router;
