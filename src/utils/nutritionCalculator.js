/**
 * Pure calculation helpers for the DailyFit calorie counter.
 * No I/O, no Prisma — safe to unit test in isolation.
 */

const MALE_ALIASES = new Set(["male", "m", "masculino", "hombre"]);
const FEMALE_ALIASES = new Set(["female", "f", "femenino", "mujer"]);

/** Goal-specific kcal adjustment and protein target, keyed by `goal_id`. */
const GOAL_CONFIG = {
  1: { kcalAdjustment: -0.2, proteinPerKg: 2.0 }, // Lose weight
  2: { kcalAdjustment: 0.1, proteinPerKg: 1.8 }, // Build muscle
  3: { kcalAdjustment: 0, proteinPerKg: 1.6 }, // Maintain shape
  4: { kcalAdjustment: 0, proteinPerKg: 1.4 }, // Improve endurance
  5: { kcalAdjustment: -0.1, proteinPerKg: 2.0 }, // Tone up
  6: { kcalAdjustment: 0.05, proteinPerKg: 1.8 }, // Build strength
  7: { kcalAdjustment: 0, proteinPerKg: 1.6 }, // Flexibility
  8: { kcalAdjustment: 0, proteinPerKg: 1.6 }, // General health
};
const DEFAULT_GOAL_CONFIG = GOAL_CONFIG[3];

const getGoalConfig = (goalId) => GOAL_CONFIG[goalId] ?? DEFAULT_GOAL_CONFIG;

const round1 = (value) => Math.round(value * 10) / 10;
const round2 = (value) => Math.round(value * 100) / 100;

/** Normalizes free-text gender into "male" | "female" | null (unknown). */
const normalizeGender = (gender) => {
  if (typeof gender !== "string") return null;
  const normalized = gender.trim().toLowerCase();
  if (MALE_ALIASES.has(normalized)) return "male";
  if (FEMALE_ALIASES.has(normalized)) return "female";
  return null;
};

/** Age in whole years, computed from a date of birth using UTC calendar fields. */
export const calculateAge = (dateOfBirth, now = new Date()) => {
  const dob = new Date(dateOfBirth);

  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - dob.getUTCMonth();
  const dayDiff = now.getUTCDate() - dob.getUTCDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return age;
};

/**
 * Basal Metabolic Rate via the Mifflin-St Jeor equation.
 * Gender is free text in the DB: unknown or missing gender averages the
 * male/female offsets (+5 and -161 -> -78) instead of guessing.
 *
 * @throws {Error} INCOMPLETE_PROFILE when weight, height, or age is missing.
 */
export const calculateBmr = ({ weightKg, heightCm, age, gender }) => {
  if (!Number.isFinite(weightKg) || !Number.isFinite(heightCm) || !Number.isFinite(age)) {
    throw new Error("INCOMPLETE_PROFILE");
  }

  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const normalizedGender = normalizeGender(gender);

  if (normalizedGender === "male") return base + 5;
  if (normalizedGender === "female") return base - 161;
  return base - 78;
};

/** Maps a weekly training-days count to a Harris-Benedict-style activity factor. */
export const getActivityFactor = (trainingDaysCount) => {
  const days = Number(trainingDaysCount) || 0;
  if (days <= 1) return 1.2;
  if (days <= 3) return 1.375;
  if (days <= 5) return 1.55;
  return 1.725;
};

/**
 * Computes daily nutrition targets from a user's profile and goal.
 *
 * @throws {Error} INCOMPLETE_PROFILE when weight, height, or date of birth is missing.
 */
export const calculateTargets = ({
  weightKg,
  heightCm,
  dateOfBirth,
  gender,
  goalId,
  trainingDaysCount,
}) => {
  if (weightKg == null || heightCm == null || dateOfBirth == null) {
    throw new Error("INCOMPLETE_PROFILE");
  }

  const age = calculateAge(dateOfBirth);
  const bmr = calculateBmr({ weightKg, heightCm, age, gender });
  const activityFactor = getActivityFactor(trainingDaysCount);
  const tdee = bmr * activityFactor;

  const goalConfig = getGoalConfig(goalId);
  const calories = Math.round(tdee * (1 + goalConfig.kcalAdjustment));

  const proteinG = round1(goalConfig.proteinPerKg * weightKg);
  const fatG = round1(Math.max((0.25 * calories) / 9, 0.8 * weightKg));
  const carbsG = round1(Math.max(0, (calories - proteinG * 4 - fatG * 9) / 4));

  return {
    bmr: round2(bmr),
    tdee: round2(tdee),
    activity_factor: activityFactor,
    calories,
    protein_g: proteinG,
    fat_g: fatG,
    carbs_g: carbsG,
  };
};

/**
 * Classifies a consumed value against its target:
 * UNDER (<0.95x) | MET (0.95x-1.10x) | OVER (1.10x-1.30x) | WAY_OVER (>1.30x).
 * A missing/zero target is MET only when nothing was consumed either.
 */
export const getMacroState = (consumed, target) => {
  const consumedNum = Number(consumed) || 0;
  const targetNum = Number(target);

  if (!Number.isFinite(targetNum) || targetNum <= 0) {
    return consumedNum <= 0 ? "MET" : "WAY_OVER";
  }

  const ratio = consumedNum / targetNum;
  if (ratio < 0.95) return "UNDER";
  if (ratio <= 1.1) return "MET";
  if (ratio <= 1.3) return "OVER";
  return "WAY_OVER";
};

/**
 * Rolls up the four macro states into a single day status.
 * Exceeding a macro (OVER/WAY_OVER) never counts as met.
 */
export const getDayStatus = (consumedTotals, targets) => {
  const macros = ["calories", "protein_g", "fat_g", "carbs_g"];
  const metCount = macros.filter(
    (macro) => getMacroState(consumedTotals[macro], targets[macro]) === "MET",
  ).length;

  if (metCount === 4) return "COMPLETED";
  if (metCount === 0) return "NONE";
  return "PARTIAL";
};

/** Display order for meal groups; also determines which groups are emitted. */
export const MEAL_TYPE_ORDER = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"];

/**
 * Groups meals by `meal_type`, in `MEAL_TYPE_ORDER`, with per-group totals.
 * Meal types with no meals are omitted entirely.
 */
export const groupMealsByType = (meals) => {
  const byType = new Map();

  for (const meal of meals) {
    if (!byType.has(meal.meal_type)) byType.set(meal.meal_type, []);
    byType.get(meal.meal_type).push(meal);
  }

  return MEAL_TYPE_ORDER.filter((mealType) => byType.has(mealType)).map((mealType) => {
    const items = byType.get(mealType);
    const totals = items.reduce(
      (acc, item) => ({
        calories: acc.calories + Number(item.calories),
        protein_g: acc.protein_g + Number(item.protein_g),
        fat_g: acc.fat_g + Number(item.fat_g),
        carbs_g: acc.carbs_g + Number(item.carbs_g),
      }),
      { calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0 },
    );

    return { meal_type: mealType, totals, items };
  });
};
