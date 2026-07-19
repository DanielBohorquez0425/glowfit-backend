import * as gymRepository from "../repositories/gymRepository.js";
import * as gymMembershipRepository from "../repositories/gymMembershipRepository.js";

const getISOWeekBounds = (date) => {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diffToMonday);
  monday.setUTCHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
};

export const listAllGyms = async (options = {}) => {
  return await gymRepository.findAll(options);
};

/**
 * Lista usuarios de un gym con paginación y filtro por rol.
 * La autorización (verificar que el user sea admin del gym) se hace en el middleware.
 *
 * @param {string} gymId
 * @param {Object} options
 * @param {number} options.limit
 * @param {number} options.offset
 * @param {string} [options.role]
 */
export const listGymUsers = async (gymId, options = {}) => {
  return await gymMembershipRepository.findUsersByGymId(gymId, options);
};

export const getNewMembersStats = async (gymId) => {
  const now = new Date();
  const thisWeek = getISOWeekBounds(now);

  const lastWeekAnchor = new Date(now);
  lastWeekAnchor.setUTCDate(now.getUTCDate() - 7);
  const lastWeek = getISOWeekBounds(lastWeekAnchor);

  const [thisWeekCount, lastWeekCount] = await Promise.all([
    gymMembershipRepository.countNewMembersByDateRange(gymId, thisWeek.start, thisWeek.end),
    gymMembershipRepository.countNewMembersByDateRange(gymId, lastWeek.start, lastWeek.end),
  ]);

  let percentageChange;
  if (lastWeekCount === 0) {
    percentageChange = thisWeekCount > 0 ? 100 : 0;
  } else {
    percentageChange = parseFloat(
      (((thisWeekCount - lastWeekCount) / lastWeekCount) * 100).toFixed(1)
    );
  }

  const trend = percentageChange > 0 ? "up" : percentageChange < 0 ? "down" : "neutral";

  return { thisWeek: thisWeekCount, lastWeek: lastWeekCount, percentageChange, trend };
};
