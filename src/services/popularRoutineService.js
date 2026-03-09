import * as popularRoutineRepository from "../repositories/popularRoutineRepository.js";

const VALID_LEVELS = ["beginner", "intermediate", "advanced"];

export const getPopularRoutines = async (level) => {
  if (level && !VALID_LEVELS.includes(level)) {
    throw new Error(
      `Nivel inválido. Los valores permitidos son: ${VALID_LEVELS.join(", ")}`
    );
  }

  return await popularRoutineRepository.getPopularRoutines(level);
};
