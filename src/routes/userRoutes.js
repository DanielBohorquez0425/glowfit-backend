import express from "express";
import {
  register,
  login,
  logout,
  logoutAllSessions,
  refreshToken,
  getUsers,
  getProfile,
  updateUser,
  getUserById,
  getUserActivity,
} from "../controllers/userController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { authLimiter } from "../middlewares/rateLimitMiddleware.js";

const router = express.Router();

// rutas publicas con rate limiting estricto
router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/refresh-token", authLimiter, refreshToken);
router.post("/logout", logout);

// rutas privadas
router.post("/logout-all", authenticateToken, logoutAllSessions);
router.get("/all-users", authenticateToken, getUsers);
router.get("/profile", authenticateToken, getProfile);
router.get("/:id/activity", authenticateToken, getUserActivity);
router.get("/:id", authenticateToken, getUserById);
router.put("/:id", authenticateToken, updateUser);

export default router;
