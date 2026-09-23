import prisma from "../config/prismaClient.js";

// ── Nutrition targets ────────────────────────────────────────────────────────

export const findTargetsByUserId = async (userId, tx = prisma) => {
  return await tx.user_nutrition_targets.findUnique({ where: { user_id: userId } });
};

export const upsertTargets = async (userId, data, tx = prisma) => {
  return await tx.user_nutrition_targets.upsert({
    where: { user_id: userId },
    create: { user_id: userId, ...data },
    update: data,
  });
};

/** Profile fields needed to compute nutrition targets, including weekly training days count. */
export const findProfileForTargets = async (userId, tx = prisma) => {
  const user = await tx.user.findFirst({
    where: { id: userId, deleted_at: null },
    select: {
      weight: true,
      height: true,
      date_of_birth: true,
      gender: true,
      goal_id: true,
      _count: { select: { user_training_days: true } },
    },
  });
  if (!user) return null;

  return {
    weight: user.weight,
    height: user.height,
    date_of_birth: user.date_of_birth,
    gender: user.gender,
    goal_id: user.goal_id,
    trainingDaysCount: user._count.user_training_days,
  };
};

// ── Daily logs ────────────────────────────────────────────────────────────────

export const findDailyLogWithMeals = async (userId, logDate, tx = prisma) => {
  return await tx.daily_nutrition_logs.findUnique({
    where: { user_id_log_date: { user_id: userId, log_date: logDate } },
    include: { meal_entries: { orderBy: { created_at: "asc" } } },
  });
};

export const findDailyLog = async (userId, logDate, tx = prisma) => {
  return await tx.daily_nutrition_logs.findUnique({
    where: { user_id_log_date: { user_id: userId, log_date: logDate } },
  });
};

export const findDailyLogById = async (logId, tx = prisma) => {
  return await tx.daily_nutrition_logs.findUnique({ where: { id: logId } });
};

export const createDailyLog = async (userId, logDate, targetsSnapshot, tx = prisma) => {
  return await tx.daily_nutrition_logs.create({
    data: {
      user_id: userId,
      log_date: logDate,
      target_calories: targetsSnapshot.calories,
      target_protein_g: targetsSnapshot.protein_g,
      target_fat_g: targetsSnapshot.fat_g,
      target_carbs_g: targetsSnapshot.carbs_g,
    },
  });
};

export const updateDailyLogTotals = async (logId, totals, tx = prisma) => {
  return await tx.daily_nutrition_logs.update({
    where: { id: logId },
    data: {
      consumed_calories: totals.consumed_calories,
      consumed_protein_g: totals.consumed_protein_g,
      consumed_fat_g: totals.consumed_fat_g,
      consumed_carbs_g: totals.consumed_carbs_g,
      status: totals.status,
    },
  });
};

/** Logs within [from, to], for calendar rendering. Missing days simply have no row. */
export const findLogsInRange = async (userId, from, to, tx = prisma) => {
  return await tx.daily_nutrition_logs.findMany({
    where: { user_id: userId, log_date: { gte: from, lte: to } },
    select: { log_date: true, status: true },
    orderBy: { log_date: "asc" },
  });
};

// ── Meal entries ──────────────────────────────────────────────────────────────

export const createMeal = async (data, tx = prisma) => {
  return await tx.meal_entries.create({ data });
};

export const updateMeal = async (mealId, data, tx = prisma) => {
  return await tx.meal_entries.update({ where: { id: mealId }, data });
};

export const deleteMeal = async (mealId, tx = prisma) => {
  return await tx.meal_entries.delete({ where: { id: mealId } });
};

export const findMealByIdAndUser = async (mealId, userId, tx = prisma) => {
  return await tx.meal_entries.findFirst({ where: { id: mealId, user_id: userId } });
};

export const findMealsByLogId = async (logId, tx = prisma) => {
  return await tx.meal_entries.findMany({
    where: { daily_log_id: logId },
    orderBy: { created_at: "asc" },
  });
};
