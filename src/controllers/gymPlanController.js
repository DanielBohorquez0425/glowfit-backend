import * as gymPlanService from "../services/gymPlanService.js";

/** Serializa un plan: `price` es Decimal en Prisma y llega como objeto al JSON. */
const mapPlan = (plan) => ({
  id: plan.id,
  name: plan.name,
  description: plan.description,
  price: Number(plan.price),
  currency: plan.currency,
  duration_value: plan.duration_value,
  duration_unit: plan.duration_unit,
  features: plan.features,
  is_active: plan.is_active,
  created_at: plan.created_at,
  updated_at: plan.updated_at,
});

const VALIDATION_ERRORS = {
  INVALID_NAME: "El nombre del plan es obligatorio y admite hasta 100 caracteres.",
  INVALID_PRICE: "El precio debe ser un número mayor o igual a 0.",
  INVALID_DURATION_VALUE: "La duración debe ser un entero entre 1 y 60.",
  INVALID_DURATION_UNIT: `La unidad de duración debe ser una de: ${gymPlanService.VALID_DURATION_UNITS.join(", ")}.`,
  INVALID_FEATURES: "Las características deben ser textos no vacíos de hasta 120 caracteres.",
  TOO_MANY_FEATURES: "Un plan admite hasta 20 características.",
  INVALID_IS_ACTIVE: "'isActive' debe ser booleano.",
  NO_FIELDS_TO_UPDATE: "No se envió ningún campo para actualizar.",
  PLAN_NAME_TAKEN: "Ya existe un plan con ese nombre en el gimnasio.",
};

/**
 * Traduce los códigos de error del service a respuestas HTTP.
 * Devuelve true si el error fue manejado.
 */
const handlePlanError = (error, res, fallbackMessage) => {
  const validationMessage = VALIDATION_ERRORS[error.message];
  if (validationMessage) {
    const status = error.message === "PLAN_NAME_TAKEN" ? 409 : 400;
    res.status(status).json({ error: validationMessage });
    return true;
  }

  if (error.message === "PLAN_NOT_FOUND" || error.code === "P2025") {
    res.status(404).json({ error: "No se encontró el plan." });
    return true;
  }

  console.error(`${fallbackMessage}:`, error);
  res.status(500).json({ error: fallbackMessage });
  return true;
};

/**
 * GET /gyms/:gymId/plans
 *
 * Lista los planes del gym. Solo GYM_ADMIN del gym.
 *
 * Query params:
 *   - includeInactive (default: false) — incluye planes archivados
 */
export const listPlans = async (req, res) => {
  try {
    const { gymId } = req.params;
    const includeInactive = req.query.includeInactive === "true";

    const plans = await gymPlanService.listPlans(gymId, { includeInactive });

    res.json({ success: true, data: plans.map(mapPlan) });
  } catch (error) {
    console.error("Error al obtener los planes del gym:", error);
    res.status(500).json({ error: "Error interno al obtener los planes." });
  }
};

/**
 * POST /gyms/:gymId/plans
 *
 * Crea un plan. Solo GYM_ADMIN del gym.
 *
 * Body:
 *   { name, price, durationValue, durationUnit, features?, description?, currency? }
 */
export const createPlan = async (req, res) => {
  try {
    const { gymId } = req.params;
    const plan = await gymPlanService.createPlan(gymId, req.body);

    res.status(201).json({ success: true, data: mapPlan(plan) });
  } catch (error) {
    handlePlanError(error, res, "Error interno al crear el plan.");
  }
};

/**
 * PATCH /gyms/:gymId/plans/:planId
 *
 * Actualiza un plan. Solo GYM_ADMIN del gym.
 * Los pagos ya registrados no cambian: la Caja guarda su propio snapshot.
 */
export const updatePlan = async (req, res) => {
  try {
    const { gymId, planId } = req.params;
    const plan = await gymPlanService.updatePlan(gymId, planId, req.body);

    res.json({ success: true, data: mapPlan(plan) });
  } catch (error) {
    handlePlanError(error, res, "Error interno al actualizar el plan.");
  }
};

/**
 * DELETE /gyms/:gymId/plans/:planId
 *
 * Da de baja un plan. Solo GYM_ADMIN del gym.
 * Si tiene pagos o socios asociados se archiva en lugar de borrarse.
 */
export const deletePlan = async (req, res) => {
  try {
    const { gymId, planId } = req.params;
    const { archived } = await gymPlanService.deletePlan(gymId, planId);

    res.json({
      success: true,
      data: {
        archived,
        message: archived
          ? "El plan tiene historial asociado, se archivó en lugar de borrarse."
          : "Plan eliminado.",
      },
    });
  } catch (error) {
    handlePlanError(error, res, "Error interno al eliminar el plan.");
  }
};
