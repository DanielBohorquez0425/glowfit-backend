import express from "express";
import * as routineController from "../controllers/routineController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { aiLimiter } from "../middlewares/rateLimitMiddleware.js";

const router = express.Router();

router.post("/", authenticateToken, routineController.createRoutine);
router.get("/predefined", authenticateToken, routineController.getPredefinedRoutines);
router.get("/user/:userId", routineController.getRoutinesByUser);
router.get("/:id", routineController.getRoutineById);
router.put("/:id", routineController.updateRoutine);
router.post(
  "/generate-ai",
  aiLimiter,
  authenticateToken,
  routineController.generateAIRoutine
);
router.patch(
  "/:id/complete",
  authenticateToken,
  routineController.markRoutineAsCompleted
);

export default router;
