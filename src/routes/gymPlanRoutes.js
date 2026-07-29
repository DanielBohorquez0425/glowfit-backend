import { Router } from "express";
import {
  listPlans,
  createPlan,
  updatePlan,
  deletePlan,
} from "../controllers/gymPlanController.js";
import { assignPlan, listPayments } from "../controllers/gymPaymentController.js";
import { authenticateToken, requireGymRole } from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/:gymId/plans", authenticateToken, requireGymRole("GYM_ADMIN"), listPlans);
router.post("/:gymId/plans", authenticateToken, requireGymRole("GYM_ADMIN"), createPlan);
router.patch(
  "/:gymId/plans/:planId",
  authenticateToken,
  requireGymRole("GYM_ADMIN"),
  updatePlan,
);
router.delete(
  "/:gymId/plans/:planId",
  authenticateToken,
  requireGymRole("GYM_ADMIN"),
  deletePlan,
);

router.post(
  "/:gymId/members/:userId/plan",
  authenticateToken,
  requireGymRole("GYM_ADMIN"),
  assignPlan,
);

router.get("/:gymId/payments", authenticateToken, requireGymRole("GYM_ADMIN"), listPayments);

export default router;
