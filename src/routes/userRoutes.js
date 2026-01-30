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
} from "../controllers/userController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { authLimiter } from "../middlewares/rateLimitMiddleware.js";

const router = express.Router();

// rutas publicas con rate limiting estricto
router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);

// rutas privadas
router.post("/logout", authenticateToken, logout);
router.get("/all-users", authenticateToken, getUsers);
router.get("/profile", authenticateToken, getProfile);
router.get("/:id/activity", authenticateToken, getUserActivity);
router.get("/:id", authenticateToken, getUserById);
router.put("/:id", authenticateToken, updateUser);
router.patch("/:userId/active-routine", authenticateToken, setActiveRoutine);

export default router;
