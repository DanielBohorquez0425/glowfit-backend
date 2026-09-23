import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateAge,
  calculateBmr,
  getActivityFactor,
  calculateTargets,
  getMacroState,
  getDayStatus,
} from "../../src/utils/nutritionCalculator.js";

// ── calculateAge ────────────────────────────────────────────────────────────

test("calculateAge: birthday already passed this year", () => {
  const now = new Date(Date.UTC(2026, 5, 15)); // 2026-06-15
  const dob = new Date(Date.UTC(2000, 0, 1)); // 2000-01-01
  assert.equal(calculateAge(dob, now), 26);
});

test("calculateAge: birthday not yet reached this year", () => {
  const now = new Date(Date.UTC(2026, 5, 15)); // 2026-06-15
  const dob = new Date(Date.UTC(2000, 11, 31)); // 2000-12-31
  assert.equal(calculateAge(dob, now), 25);
});

test("calculateAge: birthday is today", () => {
  const now = new Date(Date.UTC(2026, 5, 15));
  const dob = new Date(Date.UTC(1990, 5, 15));
  assert.equal(calculateAge(dob, now), 36);
});

// ── calculateBmr ─────────────────────────────────────────────────────────────

test("calculateBmr: male formula (Mifflin-St Jeor)", () => {
  const bmr = calculateBmr({ weightKg: 80, heightCm: 180, age: 30, gender: "male" });
  // 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
  assert.equal(bmr, 1780);
});

test("calculateBmr: accepts spanish/short gender aliases for male", () => {
  const expected = calculateBmr({ weightKg: 80, heightCm: 180, age: 30, gender: "male" });
  for (const alias of ["m", "masculino", "hombre", "Masculino", " M "]) {
    assert.equal(
      calculateBmr({ weightKg: 80, heightCm: 180, age: 30, gender: alias }),
      expected,
    );
  }
});

test("calculateBmr: female formula (Mifflin-St Jeor)", () => {
  const bmr = calculateBmr({ weightKg: 65, heightCm: 165, age: 25, gender: "female" });
  // 10*65 + 6.25*165 - 5*25 - 161 = 650 + 1031.25 - 125 - 161 = 1395.25
  assert.equal(bmr, 1395.25);
});

test("calculateBmr: accepts spanish/short gender aliases for female", () => {
  const expected = calculateBmr({ weightKg: 65, heightCm: 165, age: 25, gender: "female" });
  for (const alias of ["f", "femenino", "mujer", "Femenino", " F "]) {
    assert.equal(
      calculateBmr({ weightKg: 65, heightCm: 165, age: 25, gender: alias }),
      expected,
    );
  }
});

test("calculateBmr: unknown gender averages both formulas", () => {
  const bmr = calculateBmr({ weightKg: 70, heightCm: 170, age: 28, gender: "other" });
  // base = 10*70 + 6.25*170 - 5*28 = 700 + 1062.5 - 140 = 1622.5
  // average adjustment = (5 + -161) / 2 = -78
  assert.equal(bmr, 1622.5 - 78);
});

test("calculateBmr: missing gender averages both formulas", () => {
  const bmr = calculateBmr({ weightKg: 70, heightCm: 170, age: 28 });
  assert.equal(bmr, 1622.5 - 78);
});

test("calculateBmr: throws INCOMPLETE_PROFILE when weight is missing", () => {
  assert.throws(
    () => calculateBmr({ heightCm: 170, age: 28, gender: "male" }),
    /INCOMPLETE_PROFILE/,
  );
});

test("calculateBmr: throws INCOMPLETE_PROFILE when height is missing", () => {
  assert.throws(
    () => calculateBmr({ weightKg: 70, age: 28, gender: "male" }),
    /INCOMPLETE_PROFILE/,
  );
});

test("calculateBmr: throws INCOMPLETE_PROFILE when age is missing", () => {
  assert.throws(
    () => calculateBmr({ weightKg: 70, heightCm: 170, gender: "male" }),
    /INCOMPLETE_PROFILE/,
  );
});

// ── getActivityFactor ─────────────────────────────────────────────────────────

test("getActivityFactor: buckets", () => {
  assert.equal(getActivityFactor(0), 1.2);
  assert.equal(getActivityFactor(1), 1.2);
  assert.equal(getActivityFactor(2), 1.375);
  assert.equal(getActivityFactor(3), 1.375);
  assert.equal(getActivityFactor(4), 1.55);
  assert.equal(getActivityFactor(5), 1.55);
  assert.equal(getActivityFactor(6), 1.725);
  assert.equal(getActivityFactor(7), 1.725);
});

test("getActivityFactor: clamps values above 7 to the highest bucket", () => {
  assert.equal(getActivityFactor(10), 1.725);
});

// ── calculateTargets ─────────────────────────────────────────────────────────

const baseProfile = {
  weightKg: 80,
  heightCm: 180,
  dateOfBirth: new Date(Date.UTC(1996, 5, 15)), // 30 y/o on 2026-06-15
  gender: "male",
  trainingDaysCount: 3, // activity factor 1.375
};

test("calculateTargets: goal 1 (lose weight) applies -20% kcal and 2.0 g/kg protein", () => {
  const now = new Date(Date.UTC(2026, 5, 15));
  const age = calculateAge(baseProfile.dateOfBirth, now);
  const bmr = calculateBmr({ ...baseProfile, age });
  const tdee = bmr * 1.375;

  const targets = calculateTargets({ ...baseProfile, goalId: 1 });

  assert.equal(targets.calories, Math.round(tdee * 0.8));
  assert.equal(targets.protein_g, Math.round(2.0 * baseProfile.weightKg * 10) / 10);
});

test("calculateTargets: goal 2 (build muscle) applies +10% kcal and 1.8 g/kg protein", () => {
  const bmr = calculateBmr({ ...baseProfile, age: calculateAge(baseProfile.dateOfBirth) });
  const tdee = bmr * 1.375;

  const targets = calculateTargets({ ...baseProfile, goalId: 2 });

  assert.equal(targets.calories, Math.round(tdee * 1.1));
  assert.equal(targets.protein_g, Math.round(1.8 * baseProfile.weightKg * 10) / 10);
});

test("calculateTargets: goal 3 (maintain shape) applies no kcal adjustment and 1.6 g/kg protein", () => {
  const bmr = calculateBmr({ ...baseProfile, age: calculateAge(baseProfile.dateOfBirth) });
  const tdee = bmr * 1.375;

  const targets = calculateTargets({ ...baseProfile, goalId: 3 });

  assert.equal(targets.calories, Math.round(tdee));
  assert.equal(targets.protein_g, Math.round(1.6 * baseProfile.weightKg * 10) / 10);
});

test("calculateTargets: goal 4 (improve endurance) applies no kcal adjustment and 1.4 g/kg protein", () => {
  const targets = calculateTargets({ ...baseProfile, goalId: 4 });
  assert.equal(targets.protein_g, Math.round(1.4 * baseProfile.weightKg * 10) / 10);
});

test("calculateTargets: goal 5 (tone up) applies -10% kcal and 2.0 g/kg protein", () => {
  const bmr = calculateBmr({ ...baseProfile, age: calculateAge(baseProfile.dateOfBirth) });
  const tdee = bmr * 1.375;

  const targets = calculateTargets({ ...baseProfile, goalId: 5 });

  assert.equal(targets.calories, Math.round(tdee * 0.9));
  assert.equal(targets.protein_g, Math.round(2.0 * baseProfile.weightKg * 10) / 10);
});

test("calculateTargets: goal 6 (build strength) applies +5% kcal and 1.8 g/kg protein", () => {
  const bmr = calculateBmr({ ...baseProfile, age: calculateAge(baseProfile.dateOfBirth) });
  const tdee = bmr * 1.375;

  const targets = calculateTargets({ ...baseProfile, goalId: 6 });

  assert.equal(targets.calories, Math.round(tdee * 1.05));
  assert.equal(targets.protein_g, Math.round(1.8 * baseProfile.weightKg * 10) / 10);
});

test("calculateTargets: goal 7 (flexibility) matches goal 3 config", () => {
  const t3 = calculateTargets({ ...baseProfile, goalId: 3 });
  const t7 = calculateTargets({ ...baseProfile, goalId: 7 });
  assert.deepEqual(t7, t3);
});

test("calculateTargets: goal 8 (general health) matches goal 3 config", () => {
  const t3 = calculateTargets({ ...baseProfile, goalId: 3 });
  const t8 = calculateTargets({ ...baseProfile, goalId: 8 });
  assert.deepEqual(t8, t3);
});

test("calculateTargets: null goalId falls back to goal 3 config", () => {
  const t3 = calculateTargets({ ...baseProfile, goalId: 3 });
  const tNull = calculateTargets({ ...baseProfile, goalId: null });
  assert.deepEqual(tNull, t3);
});

test("calculateTargets: unknown goalId falls back to goal 3 config", () => {
  const t3 = calculateTargets({ ...baseProfile, goalId: 3 });
  const tUnknown = calculateTargets({ ...baseProfile, goalId: 999 });
  assert.deepEqual(tUnknown, t3);
});

test("calculateTargets: fat_g respects the 0.8 g/kg floor", () => {
  // Very low calorie target scenario shouldn't push fat below the g/kg floor.
  const targets = calculateTargets({
    weightKg: 100,
    heightCm: 150,
    dateOfBirth: new Date(Date.UTC(2000, 0, 1)),
    gender: "female",
    trainingDaysCount: 0,
    goalId: 1,
  });
  assert.ok(targets.fat_g >= 0.8 * 100);
});

test("calculateTargets: carbs_g never goes negative", () => {
  const targets = calculateTargets({
    weightKg: 40,
    heightCm: 150,
    dateOfBirth: new Date(Date.UTC(2000, 0, 1)),
    gender: "male",
    trainingDaysCount: 0,
    goalId: 1,
  });
  assert.ok(targets.carbs_g >= 0);
});

test("calculateTargets: throws INCOMPLETE_PROFILE when weight is missing", () => {
  assert.throws(
    () => calculateTargets({ ...baseProfile, weightKg: undefined }),
    /INCOMPLETE_PROFILE/,
  );
});

test("calculateTargets: throws INCOMPLETE_PROFILE when dateOfBirth is missing", () => {
  assert.throws(
    () => calculateTargets({ ...baseProfile, dateOfBirth: null }),
    /INCOMPLETE_PROFILE/,
  );
});

// ── getMacroState ─────────────────────────────────────────────────────────────

test("getMacroState: below 0.95 ratio is UNDER", () => {
  assert.equal(getMacroState(94, 100), "UNDER");
});

test("getMacroState: exactly 0.95 ratio is MET (lower boundary)", () => {
  assert.equal(getMacroState(95, 100), "MET");
});

test("getMacroState: exactly 1.10 ratio is MET (upper boundary)", () => {
  assert.equal(getMacroState(110, 100), "MET");
});

test("getMacroState: just above 1.10 ratio is OVER", () => {
  assert.equal(getMacroState(111, 100), "OVER");
});

test("getMacroState: exactly 1.30 ratio is OVER (upper boundary)", () => {
  assert.equal(getMacroState(130, 100), "OVER");
});

test("getMacroState: just above 1.30 ratio is WAY_OVER", () => {
  assert.equal(getMacroState(131, 100), "WAY_OVER");
});

test("getMacroState: zero/invalid target with zero consumption is MET", () => {
  assert.equal(getMacroState(0, 0), "MET");
  assert.equal(getMacroState(0, null), "MET");
});

test("getMacroState: zero/invalid target with positive consumption is WAY_OVER", () => {
  assert.equal(getMacroState(5, 0), "WAY_OVER");
});

// ── getDayStatus ──────────────────────────────────────────────────────────────

const targets = { calories: 2000, protein_g: 150, fat_g: 60, carbs_g: 200 };

test("getDayStatus: all four macros MET is COMPLETED", () => {
  const consumed = { calories: 2000, protein_g: 150, fat_g: 60, carbs_g: 200 };
  assert.equal(getDayStatus(consumed, targets), "COMPLETED");
});

test("getDayStatus: some macros MET is PARTIAL", () => {
  const consumed = { calories: 2000, protein_g: 150, fat_g: 10, carbs_g: 5 };
  assert.equal(getDayStatus(consumed, targets), "PARTIAL");
});

test("getDayStatus: no macros MET is NONE", () => {
  const consumed = { calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0 };
  assert.equal(getDayStatus(consumed, targets), "NONE");
});

test("getDayStatus: exceeding macros (OVER/WAY_OVER) does not count as MET", () => {
  const consumed = { calories: 5000, protein_g: 500, fat_g: 400, carbs_g: 900 };
  assert.equal(getDayStatus(consumed, targets), "NONE");
});
