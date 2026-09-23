import * as dailyfitService from "../services/dailyfitService.js";

/** Serializes stored targets: several fields are Decimal in Prisma and arrive as objects. */
const mapTargets = (targets) => ({
  calories: targets.calories,
  protein_g: Number(targets.protein_g),
  fat_g: Number(targets.fat_g),
  carbs_g: Number(targets.carbs_g),
  bmr: Number(targets.bmr),
  tdee: Number(targets.tdee),
  activity_factor: Number(targets.activity_factor),
  created_at: targets.created_at,
  updated_at: targets.updated_at,
});

/** Serializes a meal entry: protein_g/fat_g/carbs_g are Decimal in Prisma. */
const mapMeal = (meal) => ({
  id: meal.id,
  daily_log_id: meal.daily_log_id,
  title: meal.title,
  meal_type: meal.meal_type,
  calories: meal.calories,
  protein_g: Number(meal.protein_g),
  fat_g: Number(meal.fat_g),
  carbs_g: Number(meal.carbs_g),
  created_at: meal.created_at,
  updated_at: meal.updated_at,
});

const INCOMPLETE_PROFILE_MESSAGE =
  "Your profile is missing data needed to calculate nutrition targets (weight, height, date of birth). Please complete your profile first.";

/**
 * Translates dailyfitService error codes to HTTP responses.
 * Always returns true (handled) — callers use it as the catch-block body.
 */
const handleDailyfitError = (error, res, fallbackMessage) => {
  if (error.message === "INCOMPLETE_PROFILE") {
    res.status(422).json({ error: INCOMPLETE_PROFILE_MESSAGE });
    return true;
  }

  if (
    error.message === "INVALID_INPUT" ||
    error.message === "INVALID_DATE" ||
    error.message === "INVALID_RANGE"
  ) {
    res.status(400).json({ error: error.message });
    return true;
  }

  if (error.message === "MEAL_NOT_FOUND") {
    res.status(404).json({ error: "Meal not found." });
    return true;
  }

  if (error.message === "USER_NOT_FOUND" || error.code === "P2025") {
    res.status(404).json({ error: "Record not found." });
    return true;
  }

  console.error(`${fallbackMessage}:`, error);
  res.status(500).json({ error: fallbackMessage });
  return true;
};

/** GET /dailyfit/targets */
export const getTargets = async (req, res) => {
  try {
    const targets = await dailyfitService.getTargets(req.user.userId);
    res.json({ success: true, data: mapTargets(targets) });
  } catch (error) {
    handleDailyfitError(error, res, "Internal error while fetching nutrition targets.");
  }
};

/** POST /dailyfit/targets/recalculate */
export const recalculateTargets = async (req, res) => {
  try {
    const targets = await dailyfitService.recalculateTargets(req.user.userId);
    res.json({ success: true, data: mapTargets(targets) });
  } catch (error) {
    handleDailyfitError(error, res, "Internal error while recalculating nutrition targets.");
  }
};

/** GET /dailyfit/days/:date */
export const getDay = async (req, res) => {
  try {
    const day = await dailyfitService.getDay(req.user.userId, req.params.date);
    res.json({ success: true, data: day });
  } catch (error) {
    handleDailyfitError(error, res, "Internal error while fetching the day.");
  }
};

/** GET /dailyfit/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD */
export const getCalendar = async (req, res) => {
  try {
    const { from, to } = req.query;
    const calendar = await dailyfitService.getCalendar(req.user.userId, from, to);
    res.json({ success: true, data: calendar });
  } catch (error) {
    handleDailyfitError(error, res, "Internal error while fetching the calendar.");
  }
};

/** POST /dailyfit/meals */
export const createMeal = async (req, res) => {
  try {
    const meal = await dailyfitService.createMeal(req.user.userId, req.body);
    res.status(201).json({ success: true, data: mapMeal(meal) });
  } catch (error) {
    handleDailyfitError(error, res, "Internal error while creating the meal.");
  }
};

/** PATCH /dailyfit/meals/:id */
export const updateMeal = async (req, res) => {
  try {
    const meal = await dailyfitService.updateMeal(req.user.userId, req.params.id, req.body);
    res.json({ success: true, data: mapMeal(meal) });
  } catch (error) {
    handleDailyfitError(error, res, "Internal error while updating the meal.");
  }
};

/** DELETE /dailyfit/meals/:id */
export const deleteMeal = async (req, res) => {
  try {
    await dailyfitService.deleteMeal(req.user.userId, req.params.id);
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    handleDailyfitError(error, res, "Internal error while deleting the meal.");
  }
};
