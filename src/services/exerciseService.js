import * as exerciseRepository from "../repositories/exerciseRepository.js";

export const getExercises = async (options = {}) => {
  return await exerciseRepository.findAll(options);
};

export const getExercisesPage = async (options) => {
  const rows = await exerciseRepository.findPage(options);
  const hasMore = rows.length > options.limit;
  const data = hasMore ? rows.slice(0, options.limit) : rows;

  return {
    data,
    pagination: {
      nextCursor: hasMore ? data[data.length - 1].id : null,
      hasMore,
    },
  };
};

export const getExerciseById = async (id) => {
  return await exerciseRepository.findById(id);
};

export const createExercise = async (data) => {
  return await exerciseRepository.create(data);
};

export const updateExercise = async (id, data) => {
  return await exerciseRepository.update(id, data);
};

export const deleteExercise = async (id) => {
  return await exerciseRepository.remove(id);
};
