import { Router } from "express";
import {
  getTargets,
  recalculateTargets,
  getDay,
  getCalendar,
  estimateMeal,
  createMeal,
  updateMeal,
  deleteMeal,
} from "../controllers/dailyfitController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { aiLimiter } from "../middlewares/rateLimitMiddleware.js";

const router = Router();

router.get("/targets", authenticateToken, getTargets);
router.post("/targets/recalculate", authenticateToken, recalculateTargets);
router.get("/calendar", authenticateToken, getCalendar);
router.get("/days/:date", authenticateToken, getDay);
router.post("/meals/estimate", authenticateToken, aiLimiter, estimateMeal);
router.post("/meals", authenticateToken, createMeal);
router.patch("/meals/:id", authenticateToken, updateMeal);
router.delete("/meals/:id", authenticateToken, deleteMeal);

export default router;
