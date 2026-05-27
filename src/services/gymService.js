import * as gymRepository from "../repositories/gymRepository.js";
import * as gymMembershipRepository from "../repositories/gymMembershipRepository.js";

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
