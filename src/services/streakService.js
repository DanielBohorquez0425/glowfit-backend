import * as userRepository from "../repositories/userRepository.js";
import { computeStreakUpdate, getEffectiveStreak } from "../utils/streakCalculator.js";

/**
 * Registers a qualifying activity (routine completed or DailyFit goal reached)
 * towards the user's streak. Idempotent per calendar day.
 */
export const registerActivity = async (userId) => {
  const state = await userRepository.getStreakState(userId);
  if (!state) throw new Error("NOT_FOUND");

  const update = computeStreakUpdate({
    currentStreak: state.current_streak,
    lastActivationDate: state.last_streak_activation_date,
    today: new Date(),
  });

  if (!update.activated) return;

  await userRepository.updateStreakState(userId, {
    current_streak: update.currentStreak,
    last_streak_activation_date: update.lastActivationDate,
  });
};

export const getStreak = async (userId) => {
  const state = await userRepository.getStreakState(userId);
  if (!state) throw new Error("NOT_FOUND");

  const currentStreak = getEffectiveStreak({
    currentStreak: state.current_streak,
    lastActivationDate: state.last_streak_activation_date,
    today: new Date(),
  });

  return { currentStreak, lastActivationDate: state.last_streak_activation_date };
};
