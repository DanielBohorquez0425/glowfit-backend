import { Router } from "express";
import {
  createMuscleGroup,
  getMuscleGroups,
} from "../controllers/muscleGroupController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/", authenticateToken, getMuscleGroups);
router.post("/", authenticateToken, createMuscleGroup);

export default router;
