import express from "express";
import cors from "cors";
import userRoutes from "./routes/userRoutes.js";
import exercisesRoutes from "./routes/exercisesRoutes.js";
import indexRoutes from "./routes/index.js";
import muscleGroupRoutes from "./routes/muscleGroupRoutes.js";
import routineRoutes from "./routes/routineRoutes.js";
import xpRoutes from "./routes/xpRoutes.js";
import dotenv from "dotenv";
import { generalLimiter } from "./middlewares/rateLimitMiddleware.js";
import { startResetCompletedRoutinesJob } from "./jobs/resetCompletedRoutines.js";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json());

// Rate limiting general para toda la API
app.use(generalLimiter);

// Ruta raíz
app.get("/", (req, res) => {
  res.send("Todo listo :)");
});

// Rutas
app.use("/api", indexRoutes);

// Rutas de usuarios
app.use("/users", userRoutes);

// Rutas de ejercicios
app.use("/exercises", exercisesRoutes);

// Rutas de grupos musculares
app.use("/muscle-groups", muscleGroupRoutes);

// Rutas de rutinas
app.use("/routines", routineRoutes);

// Rutas de XP
app.use("/xp", xpRoutes);

// Jobs
startResetCompletedRoutinesJob();

export default app;
