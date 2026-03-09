import express from "express";
import * as routineController from "../controllers/routineController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { aiLimiter } from "../middlewares/rateLimitMiddleware.js";

const router = express.Router();

router.post("/", authenticateToken, routineController.createRoutine);
router.get(
  "/user/:userId",
  authenticateToken,
  routineController.getRoutinesByUser,
);
router.get("/:id", authenticateToken, routineController.getRoutineById);
router.put("/:id", authenticateToken, routineController.updateRoutine);
router.delete("/:id", authenticateToken, routineController.deleteRoutine);
router.post(
  "/generate-ai",
  aiLimiter,
  authenticateToken,
  routineController.generateAIRoutine,
);
router.patch(
  "/:id/complete",
  authenticateToken,
  routineController.markRoutineAsCompleted,
);

export default router;
