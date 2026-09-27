import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStreakUpdate, getEffectiveStreak } from "../../src/utils/streakCalculator.js";

// ── computeStreakUpdate ───────────────────────────────────────────────────────

test("computeStreakUpdate: first ever activation starts the streak at 1", () => {
  const today = new Date(Date.UTC(2026, 5, 15));
  const result = computeStreakUpdate({ currentStreak: 0, lastActivationDate: null, today });
  assert.deepEqual(result, { currentStreak: 1, lastActivationDate: today, activated: true });
});

test("computeStreakUpdate: same calendar day as last activation is a no-op", () => {
  const today = new Date(Date.UTC(2026, 5, 15, 20, 0));
  const lastActivationDate = new Date(Date.UTC(2026, 5, 15, 8, 0));
  const result = computeStreakUpdate({ currentStreak: 3, lastActivationDate, today });
  assert.equal(result.activated, false);
  assert.equal(result.currentStreak, 3);
});

test("computeStreakUpdate: next day activation increments the streak", () => {
  const lastActivationDate = new Date(Date.UTC(2026, 5, 15));
  const today = new Date(Date.UTC(2026, 5, 16));
  const result = computeStreakUpdate({ currentStreak: 3, lastActivationDate, today });
  assert.deepEqual(result, { currentStreak: 4, lastActivationDate: today, activated: true });
});

test("computeStreakUpdate: activation exactly 7 days later still grows the streak (grace boundary)", () => {
  const lastActivationDate = new Date(Date.UTC(2026, 5, 1));
  const today = new Date(Date.UTC(2026, 5, 8));
  const result = computeStreakUpdate({ currentStreak: 5, lastActivationDate, today });
  assert.deepEqual(result, { currentStreak: 6, lastActivationDate: today, activated: true });
});

test("computeStreakUpdate: activation 8+ days later resets the streak to 1", () => {
  const lastActivationDate = new Date(Date.UTC(2026, 5, 1));
  const today = new Date(Date.UTC(2026, 5, 9));
  const result = computeStreakUpdate({ currentStreak: 5, lastActivationDate, today });
  assert.deepEqual(result, { currentStreak: 1, lastActivationDate: today, activated: true });
});

// ── getEffectiveStreak ────────────────────────────────────────────────────────

test("getEffectiveStreak: no prior activation is 0", () => {
  assert.equal(
    getEffectiveStreak({ currentStreak: 0, lastActivationDate: null, today: new Date() }),
    0,
  );
});

test("getEffectiveStreak: within grace window returns the stored streak", () => {
  const lastActivationDate = new Date(Date.UTC(2026, 5, 1));
  const today = new Date(Date.UTC(2026, 5, 8));
  assert.equal(getEffectiveStreak({ currentStreak: 6, lastActivationDate, today }), 6);
});

test("getEffectiveStreak: past the grace window returns 0 without mutating stored data", () => {
  const lastActivationDate = new Date(Date.UTC(2026, 5, 1));
  const today = new Date(Date.UTC(2026, 5, 9));
  assert.equal(getEffectiveStreak({ currentStreak: 6, lastActivationDate, today }), 0);
});
