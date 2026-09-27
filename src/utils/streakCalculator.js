const MS_PER_DAY = 24 * 60 * 60 * 1000;
const STREAK_GRACE_DAYS = 7;

const toUtcMidnight = (date) =>
  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

const diffInDays = (today, lastActivationDate) =>
  Math.round((toUtcMidnight(today) - toUtcMidnight(lastActivationDate)) / MS_PER_DAY);

/**
 * Decides the next streak state after a qualifying activity (routine completed
 * or DailyFit goal reached). Increments once per calendar day, resets to 1 if
 * more than STREAK_GRACE_DAYS have passed since the last activation.
 */
export const computeStreakUpdate = ({ currentStreak = 0, lastActivationDate = null, today = new Date() }) => {
  if (!lastActivationDate) {
    return { currentStreak: 1, lastActivationDate: today, activated: true };
  }

  const diffDays = diffInDays(today, lastActivationDate);

  if (diffDays <= 0) {
    return { currentStreak, lastActivationDate, activated: false };
  }

  if (diffDays > STREAK_GRACE_DAYS) {
    return { currentStreak: 1, lastActivationDate: today, activated: true };
  }

  return { currentStreak: currentStreak + 1, lastActivationDate: today, activated: true };
};

/** Effective streak for reads: 0 once STREAK_GRACE_DAYS have elapsed with no new activation. */
export const getEffectiveStreak = ({ currentStreak = 0, lastActivationDate = null, today = new Date() }) => {
  if (!lastActivationDate) return 0;
  return diffInDays(today, lastActivationDate) > STREAK_GRACE_DAYS ? 0 : currentStreak;
};
