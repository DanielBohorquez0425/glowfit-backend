import * as gymRepository from "../repositories/gymRepository.js";

export const listAllGyms = async (options = {}) => {
  return await gymRepository.findAll(options);
};
