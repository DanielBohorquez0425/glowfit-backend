import express from "express";
import {
  register,
  login,
  logout,
  getUsers,
  getProfile,
  updateUser,
  getUserById,
  getUserActivity,
  setActiveRoutine,
  getWeeklyActivity,
  forgotPassword,
  verifyResetCode,
  resetPassword,
  setupPassword,
  switchActiveRole,
  createGymOwner,
  createGymAdmin,
} from "../controllers/userController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { authLimiter } from "../middlewares/rateLimitMiddleware.js";

const router = express.Router();

// rutas publicas con rate limiting estricto
router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/forgot-password", authLimiter, forgotPassword);
router.post("/verify-reset-code", authLimiter, verifyResetCode);
router.post("/reset-password", authLimiter, resetPassword);
router.post("/setup-password", authLimiter, setupPassword);

// rutas privadas
router.post("/create-gym-owner", authenticateToken, createGymOwner);
router.post("/create-gym-admin", authenticateToken, createGymAdmin);
router.post("/logout", authenticateToken, logout);
router.get("/all-users", authenticateToken, getUsers);
router.get("/profile", authenticateToken, getProfile);
router.patch("/profile/switch-role", authenticateToken, switchActiveRole);
router.get("/:id/activity", authenticateToken, getUserActivity);
router.get("/:id/activity/weekly", authenticateToken, getWeeklyActivity);
router.get("/:id", authenticateToken, getUserById);
router.put("/:id", authenticateToken, updateUser);
router.patch("/:userId/active-routine", authenticateToken, setActiveRoutine);

export default router;
