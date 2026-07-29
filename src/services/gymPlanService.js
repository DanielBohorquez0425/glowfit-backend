import * as gymPlanRepository from "../repositories/gymPlanRepository.js";

export const VALID_DURATION_UNITS = ["DAY", "WEEK", "MONTH", "YEAR"];

const MAX_FEATURES = 20;
const MAX_FEATURE_LENGTH = 120;

/** Normaliza las características: recorta, descarta vacías y limita la cantidad. */
const normalizeFeatures = (features) => {
  if (features === undefined) return [];
  if (!Array.isArray(features)) throw new Error("INVALID_FEATURES");

  const cleaned = features
    .filter((feature) => typeof feature === "string")
    .map((feature) => feature.trim())
    .filter(Boolean);

  if (cleaned.length !== features.length) throw new Error("INVALID_FEATURES");
  if (cleaned.length > MAX_FEATURES) throw new Error("TOO_MANY_FEATURES");
  if (cleaned.some((feature) => feature.length > MAX_FEATURE_LENGTH)) {
    throw new Error("INVALID_FEATURES");
  }

  return cleaned;
};

const validateName = (name) => {
  if (typeof name !== "string" || !name.trim()) throw new Error("INVALID_NAME");
  const trimmed = name.trim();
  if (trimmed.length > 100) throw new Error("INVALID_NAME");
  return trimmed;
};

const validatePrice = (price) => {
  const parsed = Number(price);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error("INVALID_PRICE");
  // Decimal(12,2) admite hasta 10 dígitos enteros.
  if (parsed > 9_999_999_999) throw new Error("INVALID_PRICE");
  return Math.round(parsed * 100) / 100;
};

const validateDuration = (durationValue, durationUnit) => {
  const parsed = Number(durationValue);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 60) {
    throw new Error("INVALID_DURATION_VALUE");
  }
  if (!VALID_DURATION_UNITS.includes(durationUnit)) {
    throw new Error("INVALID_DURATION_UNIT");
  }
  return parsed;
};

/**
 * El error de índice único de Prisma no distingue qué constraint falló, así que
 * se traduce por el target para dar un mensaje útil al admin.
 */
const isDuplicateNameError = (error) =>
  error.code === "P2002" &&
  (error.meta?.target === "unique_plan_name_per_gym" ||
    (Array.isArray(error.meta?.target) && error.meta.target.includes("name")));

export const listPlans = async (gymId, { includeInactive = false } = {}) => {
  return await gymPlanRepository.findByGymId(gymId, { includeInactive });
};

/**
 * Crea un plan para el gym.
 * La autorización (GYM_ADMIN del gym) se hace en el middleware.
 *
 * @param {string} gymId
 * @param {Object} input - name, price, durationValue, durationUnit, features, description, currency
 * @returns {Object} Plan creado
 */
export const createPlan = async (gymId, input) => {
  const name = validateName(input.name);
  const price = validatePrice(input.price);
  const durationValue = validateDuration(input.durationValue, input.durationUnit);
  const features = normalizeFeatures(input.features);

  try {
    return await gymPlanRepository.createPlan({
      gym_id: gymId,
      name,
      price,
      currency: input.currency?.trim().toUpperCase() || "COP",
      duration_value: durationValue,
      duration_unit: input.durationUnit,
      features,
      description: input.description?.trim() || null,
    });
  } catch (error) {
    if (isDuplicateNameError(error)) throw new Error("PLAN_NAME_TAKEN");
    throw error;
  }
};

/**
 * Actualiza un plan. Solo se tocan los campos presentes en `input`.
 *
 * Cambiar el precio no altera los pagos ya registrados: el libro de pagos
 * guarda su propio snapshot de nombre e importe.
 *
 * @param {string} gymId
 * @param {string} planId
 * @param {Object} input
 * @returns {Object} Plan actualizado
 */
export const updatePlan = async (gymId, planId, input) => {
  const plan = await gymPlanRepository.findById(planId);
  if (!plan || plan.gym_id !== gymId) throw new Error("PLAN_NOT_FOUND");

  const data = {};

  if (input.name !== undefined) data.name = validateName(input.name);
  if (input.price !== undefined) data.price = validatePrice(input.price);
  if (input.features !== undefined) data.features = normalizeFeatures(input.features);
  if (input.description !== undefined) {
    data.description = input.description?.trim() || null;
  }
  if (input.currency !== undefined) {
    data.currency = input.currency?.trim().toUpperCase() || "COP";
  }
  if (input.isActive !== undefined) {
    if (typeof input.isActive !== "boolean") throw new Error("INVALID_IS_ACTIVE");
    data.is_active = input.isActive;
  }

  // La duración se valida en conjunto: cambiar una sin la otra da vigencias raras.
  if (input.durationValue !== undefined || input.durationUnit !== undefined) {
    const durationUnit = input.durationUnit ?? plan.duration_unit;
    const durationValue = input.durationValue ?? plan.duration_value;
    data.duration_value = validateDuration(durationValue, durationUnit);
    data.duration_unit = durationUnit;
  }

  if (Object.keys(data).length === 0) throw new Error("NO_FIELDS_TO_UPDATE");

  try {
    return await gymPlanRepository.updatePlan(planId, data);
  } catch (error) {
    if (isDuplicateNameError(error)) throw new Error("PLAN_NAME_TAKEN");
    throw error;
  }
};

/**
 * Da de baja un plan.
 *
 * Si tiene pagos o socios asociados se archiva (`is_active: false`) en lugar de
 * borrarse, para no perder el historial de Caja. Solo un plan sin uso se borra.
 *
 * @param {string} gymId
 * @param {string} planId
 * @returns {{ archived: boolean }}
 */
export const deletePlan = async (gymId, planId) => {
  const plan = await gymPlanRepository.findById(planId);
  if (!plan || plan.gym_id !== gymId) throw new Error("PLAN_NOT_FOUND");

  const [payments, memberships] = await Promise.all([
    gymPlanRepository.countPayments(planId),
    gymPlanRepository.countMemberships(planId),
  ]);

  if (payments > 0 || memberships > 0) {
    await gymPlanRepository.deactivatePlan(planId);
    return { archived: true };
  }

  await gymPlanRepository.deletePlan(planId);
  return { archived: false };
};
