import { test } from "node:test";
import assert from "node:assert/strict";
import { groupMealsByType } from "../../src/utils/nutritionCalculator.js";

const meal = (overrides) => ({
  id: "id",
  title: "Meal",
  calories: 100,
  protein_g: 10,
  fat_g: 5,
  carbs_g: 8,
  meal_type: "BREAKFAST",
  ...overrides,
});

test("groupMealsByType: groups meals and orders groups BREAKFAST, LUNCH, DINNER, SNACK", () => {
  const meals = [
    meal({ id: "1", meal_type: "SNACK" }),
    meal({ id: "2", meal_type: "DINNER" }),
    meal({ id: "3", meal_type: "BREAKFAST" }),
    meal({ id: "4", meal_type: "LUNCH" }),
  ];

  const groups = groupMealsByType(meals);

  assert.deepEqual(
    groups.map((group) => group.meal_type),
    ["BREAKFAST", "LUNCH", "DINNER", "SNACK"],
  );
});

test("groupMealsByType: omits meal types with no meals", () => {
  const meals = [meal({ id: "1", meal_type: "LUNCH" })];

  const groups = groupMealsByType(meals);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].meal_type, "LUNCH");
});

test("groupMealsByType: computes per-group totals", () => {
  const meals = [
    meal({ id: "1", meal_type: "BREAKFAST", calories: 100, protein_g: 10, fat_g: 5, carbs_g: 8 }),
    meal({ id: "2", meal_type: "BREAKFAST", calories: 200, protein_g: 15, fat_g: 7, carbs_g: 12 }),
  ];

  const groups = groupMealsByType(meals);

  assert.deepEqual(groups[0].totals, {
    calories: 300,
    protein_g: 25,
    fat_g: 12,
    carbs_g: 20,
  });
});

test("groupMealsByType: keeps items in each group", () => {
  const meals = [
    meal({ id: "1", meal_type: "SNACK" }),
    meal({ id: "2", meal_type: "SNACK" }),
  ];

  const groups = groupMealsByType(meals);

  assert.equal(groups[0].items.length, 2);
  assert.deepEqual(
    groups[0].items.map((item) => item.id),
    ["1", "2"],
  );
});

test("groupMealsByType: empty input returns no groups", () => {
  assert.deepEqual(groupMealsByType([]), []);
});
