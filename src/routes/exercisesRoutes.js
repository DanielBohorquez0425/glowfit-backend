import { Router } from "express";
import {
  createExercise,
  deleteExercise,
  getExerciseById,
  getExercises,
  updateExercise,
} from "../controllers/exercisesController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/", authenticateToken, getExercises);
router.get("/:id", authenticateToken, getExerciseById);
router.post("/", authenticateToken, createExercise);
router.put("/:id", authenticateToken, updateExercise);
router.delete("/:id", authenticateToken, deleteExercise);

export default router;
