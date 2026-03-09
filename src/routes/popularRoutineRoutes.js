import express from "express";
import * as popularRoutineController from "../controllers/popularRoutineController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", authenticateToken, popularRoutineController.getPopularRoutines);

export default router;
