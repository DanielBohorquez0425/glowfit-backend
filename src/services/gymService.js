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

const VALID_GYM_ROLES = ["GYM_ADMIN", "TRAINER", "MEMBER"];

/**
 * Actualiza los roles de gym de un miembro (agrega y/o quita).
 * Si se agregan roles, el último rol agregado queda como active_role.
 * La autorización (GYM_ADMIN del gym) se hace en el middleware.
 *
 * @param {string} gymId
 * @param {string} userId - user_id del miembro a modificar
 * @param {Object} changes
 * @param {string[]} [changes.add] - Roles a agregar
 * @param {string[]} [changes.remove] - Roles a quitar
 * @returns {Object} Membresía actualizada
 */
export const updateMemberRoles = async (gymId, userId, { add = [], remove = [] }) => {
  const invalid = [...add, ...remove].filter((role) => !VALID_GYM_ROLES.includes(role));
  if (invalid.length > 0) throw new Error("INVALID_ROLE");

  const membership = await gymMembershipRepository.findMembershipByUserId(userId);
  if (!membership || membership.gym_id !== gymId) throw new Error("MEMBERSHIP_NOT_FOUND");

  const roles = new Set(membership.gym_roles);
  add.forEach((role) => roles.add(role));
  remove.forEach((role) => roles.delete(role));

  const finalRoles = [...roles];
  if (finalRoles.length === 0) throw new Error("CANNOT_REMOVE_LAST_ROLE");

  // Al agregar roles, el último rol agregado pasa a ser el activo.
  const lastAddedRole = [...add].reverse().find((role) => roles.has(role));

  const activeRole =
    lastAddedRole ??
    (finalRoles.includes(membership.active_role) ? membership.active_role : finalRoles[0]);

  return await gymMembershipRepository.setGymRoles(membership.id, finalRoles, activeRole);
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
