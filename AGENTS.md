# Agent Information

This file provides context and guidelines for AI coding agents working on the **GlowFit Backend** — a REST API for training routines, exercises, users, gyms, and AI-powered routine generation.

> For the full system reference (every endpoint, model, enum, business rule), read `README.md`. This file is the **agent-oriented** layer: how to work in this codebase, conventions, common tasks, and expected behaviour.

## Project Overview for Agents

- **Tech Stack**: Node.js (ES Modules), Express 5, Prisma 6, PostgreSQL, Groq SDK (AI), Resend (email), node-cron, JWT, bcryptjs.
- **Language**: Plain JavaScript with ESM (`"type": "module"`). No TypeScript, no build step — `node`/`nodemon` run `src/server.js` directly.
- **Architecture**: Single Express monolith with strict layered separation: **Route → Controller → Service → Repository → Prisma → DB**. No microservices, no DI container, no decorators.
- **Auth**: JWT (HS256 via `JWT_SECRET`). Access token carries `{ userId, email, tokenVersion }`. Token-version invalidation on each login. Always check `authMiddleware` for protected routes.
- **AI**: Routine generation via Groq (`llama-3.3-70b-versatile`) in `src/services/aiService.js`. Output is validated JSON with exercise IDs cross-checked against the catalog.
- **No multi-tenancy**: Single schema. Gyms are data entities (`gyms`, `gym_memberships`), NOT separate tenants/schemas.

## Architecture & Layers

```
src/
├── server.js          # Entry point — dotenv + app.listen
├── app.js             # Express setup — CORS, rate limit, route mounting, cron start
├── config/            # prismaClient.js (singleton), jwtConfig.js
├── controllers/       # HTTP layer — validate input, call service, map errors → status codes
├── services/          # Business logic — orchestrate repos, apply rules, throw string-coded errors
├── repositories/      # Data access — Prisma queries ONLY, no logic
├── middlewares/       # authMiddleware, errorHandler, rateLimitMiddleware
├── routes/            # Express routers — endpoint → middleware chain → controller
├── utils/             # jwtUtils.js (sign/verify)
└── jobs/              # node-cron jobs (resetCompletedRoutines)
```

**Layer rules (do NOT violate):**
- Controllers NEVER touch Prisma directly. Services NEVER write HTTP responses. Repositories NEVER contain business logic.
- Services import repos: `import * as repo from "../repositories/...js"`.
- Controllers import services: `import * as service from "../services/...js"`.
- Errors flow up as `throw new Error("STRING_CODE")`; the controller maps codes to HTTP status.

## Git Conventions

- **Branch naming**: `feat/<scope>/<description>`, `fix/<scope>/<description>`, `chore/<scope>/<description>`.
- **Commit style**: Conventional Commits — `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`. NO AI attribution / Co-Authored-By lines.
- **PR target**: `main`.
- **Scope examples**: `auth`, `users`, `routines`, `exercises`, `gym`, `invitation`, `ai`, `db`, `infra`.
- **No force-push** to `main`.

## Common Tasks for Agents

### 1. Add a new feature (full vertical slice)
1. **Model** → edit `prisma/schema.prisma`, then `npx prisma migrate dev --name <change>` and `npx prisma generate`.
2. **Repository** → `src/repositories/<name>Repository.js` — thin Prisma queries, exported named functions.
3. **Service** → `src/services/<name>Service.js` — business logic, validation, string-coded error throwing.
4. **Controller** → `src/controllers/<name>Controller.js` — validate input, call service, map errors to HTTP.
5. **Routes** → `src/routes/<name>Routes.js` — attach middleware chain (`authenticateToken`, limiters).
6. **Register** → mount in `src/app.js`: `app.use("/prefix", <name>Routes)`.

### 2. Add a new DB table/column
1. Edit `prisma/schema.prisma`.
2. `npx prisma migrate dev --name <descriptive_name>` (creates migration + applies).
3. `npx prisma generate` (refresh client).
4. Never hand-edit existing migration files under `prisma/migrations/`.

### 3. Add a protected / rate-limited endpoint
```js
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { authLimiter, aiLimiter } from "../middlewares/rateLimitMiddleware.js";

router.post("/public-auth", authLimiter, controller.handler);          // brute-force sensitive
router.get("/protected", authenticateToken, controller.handler);        // requires JWT
router.post("/ai", aiLimiter, authenticateToken, controller.handler);   // cost-controlled AI
```

### 4. Run the app
- `npm run dev` — nodemon hot reload.
- `npm start` — production.
- `npx prisma studio` — inspect DB.

## Coding Style & Conventions

- **Naming**:
  - Files: `camelCase` matching layer suffix (`userService.js`, `gymRepository.js`, `routineController.js`).
  - Functions/variables: `camelCase`.
  - Prisma models mix `PascalCase` (`User`, `Exercise`, `MuscleGroup`) and `snake_case` (`routines`, `gym_memberships`) — match the EXISTING name in `schema.prisma`, don't normalize.
- **Imports**:
  - ESM only. Always include the `.js` extension in relative imports.
  - Use `import * as X from "..."` for repo/service module imports (the established pattern).
- **Async**: Always `async/await`. No raw `.then()` chains.
- **Errors**: Services `throw new Error("CODE")` with UPPER_SNAKE string codes; controllers translate. Also handle Prisma codes (e.g. `P2025` → 404).
- **Security**: Never log secrets/tokens. `forgot-password` always returns 200 (prevents email enumeration). Passwords hashed with bcryptjs.
- **Formatting**: No Prettier/ESLint config committed — match surrounding file style exactly (2-space indent, double quotes, semicolons).

### Error handling pattern
```js
// Controller — map service errors to HTTP
try {
  const result = await service.doSomething(req.params.id);
  res.json(result);
} catch (error) {
  if (error.message === "NOT_FOUND") return res.status(404).json({ error: "..." });
  if (error.code === "P2025") return res.status(404).json({ error: "Record not found" });
  console.error("doSomething failed:", error);
  res.status(500).json({ error: "Internal server error" });
}
```

```js
// Service — throw string-coded errors
if (!record) throw new Error("NOT_FOUND");
if (!valid)  throw new Error("INVALID_INPUT");
```

```js
// Repository — Prisma only, named exports
import prisma from "../config/prismaClient.js";
export const findById = async (id) => prisma.model.findUnique({ where: { id } });
```

---

# Agent Behaviour

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code (this codebase is deliberately flat — don't introduce DI, factories, or generic base classes).
- No "flexibility"/"configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.
- Remove imports/variables YOUR changes made unused; leave pre-existing dead code alone unless asked.

The test: every changed line traces directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

- "Add validation" → write a check for invalid inputs, then make it pass.
- "Fix the bug" → reproduce it, then make it pass.
- "Refactor X" → confirm behaviour identical before and after.

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

## 5. Respect the Layers

Before writing, ask: "Which layer does this belong in?"
- HTTP concern (status, headers, req/res) → **Controller**
- Business rule, orchestration, validation → **Service**
- Data read/write → **Repository**

Crossing layers (e.g. Prisma in a controller, `res.json` in a service) is a defect — flag and fix it, don't propagate it.
