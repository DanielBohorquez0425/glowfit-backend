import express from "express";
import cors from "cors";
import userRoutes from "./routes/userRoutes.js";
import exercisesRoutes from "./routes/exercisesRoutes.js";
import indexRoutes from "./routes/index.js";
import muscleGroupRoutes from "./routes/muscleGroupRoutes.js";
import routineRoutes from "./routes/routineRoutes.js";
import popularRoutineRoutes from "./routes/popularRoutineRoutes.js";
import invitationRoutes from "./routes/invitationRoutes.js";
import gymRoutes from "./routes/gymRoutes.js";
import gymClassRoutes from "./routes/gymClassRoutes.js";
import gymPlanRoutes from "./routes/gymPlanRoutes.js";
import dotenv from "dotenv";
import { generalLimiter } from "./middlewares/rateLimitMiddleware.js";
import { startResetCompletedRoutinesJob } from "./jobs/resetCompletedRoutines.js";
import { startExpireMembershipsJob } from "./jobs/expireMemberships.js";

dotenv.config();

const app = express();

// Necesario para que express-rate-limit funcione correctamente detrás de proxies (Render, Heroku, etc.)
app.set("trust proxy", 1);

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
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

// Rutas de rutinas populares
app.use("/popular-routines", popularRoutineRoutes);

// Rutas de invitaciones
app.use("/invitations", invitationRoutes);

// Rutas de gyms
app.use("/gyms", gymRoutes);

// Rutas de clases de gimnasio
app.use("/gyms", gymClassRoutes);

// Rutas de planes y caja del gimnasio
app.use("/gyms", gymPlanRoutes);

// Jobs
startResetCompletedRoutinesJob();
startExpireMembershipsJob();

export default app;
