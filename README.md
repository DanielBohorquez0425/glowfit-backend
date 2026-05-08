# GlowFit Backend

API REST para la plataforma GlowFit — gestión de rutinas de entrenamiento, ejercicios, usuarios, gimnasios y generación de rutinas con IA (Groq).

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js (ES Modules) |
| Framework | Express 5 |
| ORM | Prisma 6 |
| Database | PostgreSQL |
| Auth | JWT (access token + token version invalidation) |
| AI | Groq SDK (llama-3.3-70b-versatile) |
| Email | Resend |
| Cron | node-cron |
| Password Hashing | bcryptjs |
| Rate Limiting | express-rate-limit |

## Architecture

Layered architecture (Controller → Service → Repository):

```
src/
├── server.js              # Entry point — loads dotenv, starts HTTP server
├── app.js                 # Express app setup — middleware, routes, cron jobs
├── config/
│   ├── prismaClient.js    # Singleton Prisma client
│   └── jwtConfig.js       # JWT config (secret, expiry)
├── controllers/           # HTTP layer — validate input, call services, return responses
├── services/              # Business logic layer — orchestrate repositories, apply rules
├── repositories/          # Data access layer — Prisma queries only
├── middlewares/
│   ├── authMiddleware.js  # JWT verification + token_version check
│   ├── errorHandler.js    # Express error handler
│   └── rateLimitMiddleware.js  # General, auth, and AI rate limiters
├── routes/                # Express routers — map endpoints to controllers
├── utils/
│   └── jwtUtils.js        # JWT sign/verify helpers
├── jobs/
│   └── resetCompletedRoutines.js  # Cron: resets completed routines every hour
└── services/
    ├── aiService.js       # Groq AI routine generation
    └── emailService.js    # Resend email sending
```

### Data Flow Pattern

```
Request → Route → Controller (validate) → Service (business logic) → Repository (Prisma) → DB
```

**Key conventions:**
- Controllers validate input, catch errors, map to HTTP status codes
- Services contain business logic, throw errors with string codes (e.g. `"INVALID_CODE"`, `"ROUTINE_NOT_FOUND"`)
- Repositories are thin — only Prisma queries, no business logic
- Services import repositories via `import * as repo from "../repositories/..."`
- Controllers import services via `import * as service from "../services/..."`

## Database Schema

### Core Entities

| Model | Description | Key Relations |
|-------|-------------|---------------|
| `User` | User accounts with profile, fitness data, roles | HasOne `goals`, HasMany `routine_completions`, HasOne `gym_membership` |
| `goals` | Fitness goals (strength, hypertrophy, etc.) | HasMany `User` |
| `Exercise` | Exercise catalog with metadata | BelongsTo `MuscleGroup`, HasMany `ExerciseMuscle` |
| `MuscleGroup` | Muscle group definitions | HasMany `Exercise` |
| `ExerciseMuscle` | Exercise-to-muscle mapping (primary/secondary) | BelongsTo `Exercise`, BelongsTo `MuscleGroup` |
| `routines` | User-created routines | HasMany `routine_days`, HasMany `routine_exercises`, HasMany `routine_completions` |
| `routine_days` | Days of week assigned to routines | BelongsTo `routines`, BelongsTo `days_of_week` |
| `routine_exercises` | Exercises within a routine (sets, reps, weight) | BelongsTo `routines` |
| `routine_completions` | Track when users complete routines | BelongsTo `User`, BelongsTo `routines` |
| `user_training_days` | User's available training days | BelongsTo `User`, BelongsTo `days_of_week` |
| `popular_routines` | Pre-built routine templates | HasMany `popular_routine_exercises` |
| `popular_routine_exercises` | Exercises in popular routines | BelongsTo `popular_routines`, BelongsTo `Exercise` |

### Gym Management

| Model | Description |
|-------|-------------|
| `gyms` | Gym organizations with profile info |
| `gym_memberships` | User membership in a gym (status, plan, roles) |
| `gym_invitations` | Email-based invitations to join a gym |

### Auth & Security

| Model | Description |
|-------|-------------|
| `PasswordResetCode` | 6-digit codes for password reset (hashed, 10min expiry) |
| `RefreshToken` | Refresh token storage for session management |

### Enums

| Enum | Values |
|------|--------|
| `userLevel` | `beginner`, `intermediate`, `advanced` |
| `membership_status` | `ACTIVE`, `EXPIRED`, `SUSPENDED`, `CANCELLED` |
| `invitation_status` | `PENDING`, `ACCEPTED`, `REJECTED` |
| `UserGlobalRole` | `USER`, `ADMIN`, `SUPERADMIN`, `MEMBER` |
| `GymRole` | `GYM_OWNER`, `GYM_ADMIN`, `TRAINER`, `MEMBER` |

## API Endpoints

### Authentication & Users (`/users`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/users/register` | Public (authLimiter) | Register new user |
| POST | `/users/login` | Public (authLimiter) | Login, returns accessToken |
| POST | `/users/logout` | Required | Logout (client-side token removal) |
| POST | `/users/forgot-password` | Public (authLimiter) | Request password reset code |
| POST | `/users/verify-reset-code` | Public (authLimiter) | Verify 6-digit reset code |
| POST | `/users/reset-password` | Public (authLimiter) | Reset password with token |
| GET | `/users/profile` | Required | Get authenticated user profile |
| PATCH | `/users/profile/switch-role` | Required | Switch active gym role |
| GET | `/users/all-users` | Required | List all users |
| GET | `/users/:id` | Required | Get user by ID |
| PUT | `/users/:id` | Required | Update user profile |
| GET | `/users/:id/activity` | Required | Get user routine completions (paginated) |
| GET | `/users/:id/activity/weekly` | Required | Get weekly activity summary |
| PATCH | `/users/:userId/active-routine` | Required | Set active routine for a day |

### Exercises (`/exercises`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/exercises` | Required | List all exercises |
| GET | `/exercises/:id` | Required | Get exercise by ID |
| POST | `/exercises` | Required | Create exercise |
| PUT | `/exercises/:id` | Required | Update exercise |
| DELETE | `/exercises/:id` | Required | Delete exercise |

### Muscle Groups (`/muscle-groups`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/muscle-groups` | Required | List all muscle groups |

### Routines (`/routines`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/routines` | Required | Create routine |
| GET | `/routines/user/:userId` | Required | Get routines by user |
| GET | `/routines/:id` | Required | Get routine by ID |
| PUT | `/routines/:id` | Required | Update routine |
| DELETE | `/routines/:id` | Required | Delete routine |
| POST | `/routines/generate-ai` | Required (aiLimiter) | Generate routine with AI |
| PATCH | `/routines/:id/complete` | Required | Mark routine as completed |

### Popular Routines (`/popular-routines`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/popular-routines` | Required | List popular routines |
| GET | `/popular-routines/:id` | Required | Get popular routine by ID |

### Gyms (`/gyms`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/gyms/:gymId/members` | Required | Get gym members |

### Invitations (`/invitations`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/invitations/user` | Required | Get invitations for user email |
| POST | `/invitations/send` | Required | Send gym invitation |
| PATCH | `/invitations/:id/accepted` | Required | Accept invitation |

## Authentication

### JWT Strategy
- **Access tokens**: 7-day expiry, contains `{ userId, email, tokenVersion }`
- **Token versioning**: Each login increments `token_version` on the user; middleware checks decoded version matches DB version (invalidates all previous sessions)
- **Auth header**: `Authorization: Bearer <token>`

### Rate Limiting

| Limiter | Window | Max | Purpose |
|---------|--------|-----|---------|
| `generalLimiter` | 15 min | 100/IP | General API protection |
| `authLimiter` | 15 min | 5/IP | Auth endpoints (brute force prevention) |
| `aiLimiter` | 1 hour | 10/user-ID | AI routine generation (cost control) |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for signing JWT tokens |
| `GROQ_API_KEY` | Yes | Groq API key for AI routine generation |
| `RESEND_KEY` | Yes | Resend API key for transactional emails |
| `PORT` | No | Server port (default: 3000) |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins (default: `http://localhost:3000`) |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with nodemon (hot reload) |
| `npm start` | Start production server |
| `npx prisma generate` | Generate Prisma client |
| `npx prisma migrate dev` | Run migrations in development |
| `npx prisma studio` | Open Prisma Studio |

## Cron Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| `resetCompletedRoutines` | Every hour (`0 * * * *`) | Resets `is_completed` to `false` for routines completed >24h ago |

## Key Business Rules

1. **BMI auto-calculation**: When `weight` or `height` is updated, BMI is recalculated automatically in `userService.updateUser()`
2. **Password reset flow**: 6-digit code → verified → short-lived JWT reset token → password change. Always returns 200 on forgot-password to prevent email enumeration
3. **AI routine generation**: Uses user profile (weight, height, age, goal, disability, training days) to prompt Groq. Response is validated JSON with exercise IDs cross-referenced against available exercises
4. **Active routine switching**: Atomic transaction — activates target routine, deactivates all others for the same day/user
5. **Gym role switching**: Users can switch between roles they hold in their gym membership (e.g., TRAINER ↔ MEMBER)
6. **Training days deduplication**: Controller validates no duplicate `day_id` in `user_training_days.create`

## For AI Agents

### How to add a new feature

1. **Define models** in `prisma/schema.prisma` → run `npx prisma migrate dev`
2. **Create repository** in `src/repositories/` — thin Prisma queries only
3. **Create service** in `src/services/` — business logic, validation, error throwing
4. **Create controller** in `src/controllers/` — input validation, service calls, HTTP responses
5. **Create routes** in `src/routes/` — endpoint mapping, middleware chain
6. **Register routes** in `src/app.js` — add `app.use("/prefix", routes)`

### Error handling pattern

```js
// Controller: catch service errors, map to HTTP status
try {
  const result = await service.doSomething(req.params.id);
  res.json(result);
} catch (error) {
  if (error.message === "NOT_FOUND") return res.status(404).json({ error: "..." });
  if (error.code === "P2025") return res.status(404).json({ error: "Record not found" });
  console.error("...", error);
  res.status(500).json({ error: "Internal server error" });
}
```

### Service error pattern

```js
// Service: throw string-coded errors for controller to catch
if (!record) throw new Error("NOT_FOUND");
if (!valid) throw new Error("INVALID_INPUT");
```

### Repository pattern

```js
// Repository: only Prisma queries, export named functions
import prisma from "../config/prismaClient.js";

export const findById = async (id) => {
  return await prisma.model.findUnique({ where: { id } });
};
```

### Adding middleware to routes

```js
// Public endpoint with rate limiting
router.post("/endpoint", authLimiter, controller.handler);

// Protected endpoint
router.get("/endpoint", authenticateToken, controller.handler);

// AI endpoint (cost-controlled)
router.post("/ai-endpoint", aiLimiter, authenticateToken, controller.handler);
```
