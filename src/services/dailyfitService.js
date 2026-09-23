import * as dailyfitRepository from "../repositories/dailyfitRepository.js";
import prisma from "../config/prismaClient.js";
import {
  calculateTargets,
  getMacroState,
  getDayStatus,
  groupMealsByType,
  MEAL_TYPE_ORDER,
} from "../utils/nutritionCalculator.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CALENDAR_RANGE_DAYS = 62;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const parseLogDate = (dateStr) => {
  if (typeof dateStr !== "string" || !DATE_RE.test(dateStr)) throw new Error("INVALID_DATE");

  // Parsed as UTC midnight so it matches the client's local calendar date
  // regardless of server timezone, and lines up with the @db.Date column.
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error("INVALID_DATE");
  return date;
};

const formatLogDate = (date) => date.toISOString().slice(0, 10);

const validateMealTitle = (title) => {
  if (typeof title !== "string" || !title.trim()) throw new Error("INVALID_INPUT");
  return title.trim();
};

const validateMealType = (mealType) => {
  if (!MEAL_TYPE_ORDER.includes(mealType)) throw new Error("INVALID_INPUT");
  return mealType;
};

const validateNonNegativeNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error("INVALID_INPUT");
  return parsed;
};

// ── Targets ───────────────────────────────────────────────────────────────────

export const getTargets = async (userId, tx = prisma) => {
  const existing = await dailyfitRepository.findTargetsByUserId(userId, tx);
  if (existing) return existing;
  return await recalculateTargets(userId, tx);
};

/**
 * Recomputes and stores the user's nutrition targets from their current profile.
 * Past daily logs keep their own frozen target snapshot, so this never rewrites history.
 */
export const recalculateTargets = async (userId, tx = prisma) => {
  const profile = await dailyfitRepository.findProfileForTargets(userId, tx);
  if (!profile) throw new Error("USER_NOT_FOUND");

  const computed = calculateTargets({
    weightKg: profile.weight,
    heightCm: profile.height,
    dateOfBirth: profile.date_of_birth,
    gender: profile.gender,
    goalId: profile.goal_id,
    trainingDaysCount: profile.trainingDaysCount,
  });

  return await dailyfitRepository.upsertTargets(userId, computed, tx);
};

/**
 * Recalculates targets only when the user already has stored targets. Used as
 * a hook from userService's profile update so an unrelated edit never creates
 * targets for a user who hasn't set up DailyFit yet, and never fails the
 * profile update when the profile is still incomplete for BMR calculation.
 */
export const recalculateTargetsIfExists = async (userId) => {
  const existing = await dailyfitRepository.findTargetsByUserId(userId);
  if (!existing) return null;

  try {
    return await recalculateTargets(userId);
  } catch (error) {
    if (error.message === "INCOMPLETE_PROFILE") return null;
    throw error;
  }
};

// ── Day / calendar reads ──────────────────────────────────────────────────────

const serializeMeal = (meal) => ({
  id: meal.id,
  title: meal.title,
  meal_type: meal.meal_type,
  calories: meal.calories,
  protein_g: Number(meal.protein_g),
  fat_g: Number(meal.fat_g),
  carbs_g: Number(meal.carbs_g),
  created_at: meal.created_at,
  updated_at: meal.updated_at,
});

const buildMacros = (consumed, targets) => {
  const macros = {};
  for (const macro of ["calories", "protein_g", "fat_g", "carbs_g"]) {
    macros[macro] = {
      consumed: consumed[macro],
      target: targets[macro],
      state: getMacroState(consumed[macro], targets[macro]),
    };
  }
  return macros;
};

export const getDay = async (userId, dateStr) => {
  const logDate = parseLogDate(dateStr);
  const log = await dailyfitRepository.findDailyLogWithMeals(userId, logDate);

  if (log) {
    const targets = {
      calories: log.target_calories,
      protein_g: Number(log.target_protein_g),
      fat_g: Number(log.target_fat_g),
      carbs_g: Number(log.target_carbs_g),
    };
    const consumed = {
      calories: log.consumed_calories,
      protein_g: Number(log.consumed_protein_g),
      fat_g: Number(log.consumed_fat_g),
      carbs_g: Number(log.consumed_carbs_g),
    };

    return {
      date: dateStr,
      status: log.status,
      macros: buildMacros(consumed, targets),
      meals: groupMealsByType(log.meal_entries.map(serializeMeal)),
    };
  }

  // No log yet: show today's targets with zero consumption, without creating a row.
  const currentTargets = await getTargets(userId);
  const targets = {
    calories: currentTargets.calories,
    protein_g: Number(currentTargets.protein_g),
    fat_g: Number(currentTargets.fat_g),
    carbs_g: Number(currentTargets.carbs_g),
  };
  const consumed = { calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0 };

  return {
    date: dateStr,
    status: "NONE",
    macros: buildMacros(consumed, targets),
    meals: [],
  };
};

export const getCalendar = async (userId, fromStr, toStr) => {
  const from = parseLogDate(fromStr);
  const to = parseLogDate(toStr);

  if (from > to) throw new Error("INVALID_RANGE");

  const rangeDays = Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
  if (rangeDays > MAX_CALENDAR_RANGE_DAYS) throw new Error("INVALID_RANGE");

  const logs = await dailyfitRepository.findLogsInRange(userId, from, to);

  return logs.map((log) => ({
    date: formatLogDate(log.log_date),
    status: log.status,
  }));
};

// ── Meal mutations ────────────────────────────────────────────────────────────

const getOrCreateDailyLog = async (userId, logDate, tx) => {
  const existing = await dailyfitRepository.findDailyLog(userId, logDate, tx);
  if (existing) return existing;

  const targets = await getTargets(userId, tx);
  return await dailyfitRepository.createDailyLog(userId, logDate, targets, tx);
};

/** Recomputes a log's consumed totals and status from its current meals. */
const recomputeAndUpdateLog = async (tx, log) => {
  const meals = await dailyfitRepository.findMealsByLogId(log.id, tx);

  const consumed = meals.reduce(
    (acc, meal) => ({
      consumed_calories: acc.consumed_calories + meal.calories,
      consumed_protein_g: acc.consumed_protein_g + Number(meal.protein_g),
      consumed_fat_g: acc.consumed_fat_g + Number(meal.fat_g),
      consumed_carbs_g: acc.consumed_carbs_g + Number(meal.carbs_g),
    }),
    { consumed_calories: 0, consumed_protein_g: 0, consumed_fat_g: 0, consumed_carbs_g: 0 },
  );

  const status = getDayStatus(
    {
      calories: consumed.consumed_calories,
      protein_g: consumed.consumed_protein_g,
      fat_g: consumed.consumed_fat_g,
      carbs_g: consumed.consumed_carbs_g,
    },
    {
      calories: log.target_calories,
      protein_g: Number(log.target_protein_g),
      fat_g: Number(log.target_fat_g),
      carbs_g: Number(log.target_carbs_g),
    },
  );

  return await dailyfitRepository.updateDailyLogTotals(log.id, { ...consumed, status }, tx);
};

/**
 * Meal writes run in a single transaction (get/create the day's log, write the
 * meal, then recompute the log's totals and status from the aggregated meals)
 * because the totals recompute is a business rule (`getDayStatus`), which must
 * live here rather than in the Prisma-only repository layer.
 */
export const createMeal = async (userId, input) => {
  const logDate = parseLogDate(input.date);
  const title = validateMealTitle(input.title);
  const mealType = validateMealType(input.meal_type);
  const calories = validateNonNegativeNumber(input.calories);
  const proteinG = validateNonNegativeNumber(input.protein_g);
  const fatG = validateNonNegativeNumber(input.fat_g);
  const carbsG = validateNonNegativeNumber(input.carbs_g);

  return await prisma.$transaction(async (tx) => {
    const log = await getOrCreateDailyLog(userId, logDate, tx);

    const meal = await dailyfitRepository.createMeal(
      {
        daily_log_id: log.id,
        user_id: userId,
        title,
        meal_type: mealType,
        calories,
        protein_g: proteinG,
        fat_g: fatG,
        carbs_g: carbsG,
      },
      tx,
    );

    await recomputeAndUpdateLog(tx, log);

    return meal;
  });
};

export const updateMeal = async (userId, mealId, input) => {
  return await prisma.$transaction(async (tx) => {
    const existingMeal = await dailyfitRepository.findMealByIdAndUser(mealId, userId, tx);
    if (!existingMeal) throw new Error("MEAL_NOT_FOUND");

    const data = {};
    if (input.title !== undefined) data.title = validateMealTitle(input.title);
    if (input.meal_type !== undefined) data.meal_type = validateMealType(input.meal_type);
    if (input.calories !== undefined) data.calories = validateNonNegativeNumber(input.calories);
    if (input.protein_g !== undefined) data.protein_g = validateNonNegativeNumber(input.protein_g);
    if (input.fat_g !== undefined) data.fat_g = validateNonNegativeNumber(input.fat_g);
    if (input.carbs_g !== undefined) data.carbs_g = validateNonNegativeNumber(input.carbs_g);

    if (Object.keys(data).length === 0) throw new Error("INVALID_INPUT");

    const updatedMeal = await dailyfitRepository.updateMeal(mealId, data, tx);

    const log = await dailyfitRepository.findDailyLogById(existingMeal.daily_log_id, tx);
    await recomputeAndUpdateLog(tx, log);

    return updatedMeal;
  });
};

export const deleteMeal = async (userId, mealId) => {
  return await prisma.$transaction(async (tx) => {
    const existingMeal = await dailyfitRepository.findMealByIdAndUser(mealId, userId, tx);
    if (!existingMeal) throw new Error("MEAL_NOT_FOUND");

    await dailyfitRepository.deleteMeal(mealId, tx);

    const log = await dailyfitRepository.findDailyLogById(existingMeal.daily_log_id, tx);
    await recomputeAndUpdateLog(tx, log);
  });
};
