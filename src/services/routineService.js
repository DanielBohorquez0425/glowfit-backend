import * as routineRepository from "../repositories/routineRepository.js";
import * as xpService from "./xpService.js";

export const createRoutine = async (data) => {
  // Aquí se pueden agregar validaciones adicionales si es necesario
  if (!data.name || !data.user_id) {
    throw new Error("El nombre y el ID de usuario son obligatorios");
  }

  // Validar límite de 15 rutinas por usuario
  const routineCount = await routineRepository.countUserRoutines(data.user_id);
  if (routineCount >= 15) {
    throw new Error("Has alcanzado el límite máximo de 15 rutinas");
  }

  // Validar si existen rutinas en los días especificados
  if (data.days && data.days.length > 0) {
    const hasExistingRoutines =
      await routineRepository.checkExistingRoutinesForDays(
        data.user_id,
        data.days,
      );

    // Si no se especificó is_active explícitamente, establecerlo según si existen rutinas
    if (data.is_active === undefined) {
      data.is_active = !hasExistingRoutines;
    }
  }

  return await routineRepository.createRoutine(data);
};

export const getRoutineById = async (routineId) => {
  if (!routineId) {
    throw new Error("El ID de la rutina es obligatorio");
  }
  const routine = await routineRepository.getRoutineById(routineId);
  if (!routine) {
    throw new Error("Rutina no encontrada");
  }
  return routine;
};

export const getRoutinesByUserId = async (userId) => {
  if (!userId) {
    throw new Error("El ID de usuario es obligatorio");
  }
  return await routineRepository.getRoutinesByUserId(userId);
};

export const markRoutineAsCompleted = async (routineId, userId) => {
  if (!routineId) {
    throw new Error("El ID de la rutina es obligatorio");
  }
  if (!userId) {
    throw new Error("El ID del usuario es obligatorio");
  }

  const routine = await routineRepository.markRoutineAsCompleted(
    routineId,
    userId,
  );
};

export const updateRoutine = async (id, userId, data) => {
  if (!id) {
    throw new Error("El ID de la rutina es obligatorio");
  }

  const existing = await routineRepository.getRoutineById(id);
  if (!existing) {
    throw new Error("Rutina no encontrada");
  }
  if (existing.user_id !== userId) {
    throw new Error("No tienes permisos para editar esta rutina");
  }

  return await routineRepository.updateRoutine(id, data);
};

export const deleteRoutine = async (routineId, userId) => {
  if (!routineId) {
    throw new Error("El ID de la rutina es obligatorio");
  }
  if (!userId) {
    throw new Error("El ID del usuario es obligatorio");
  }
  return await routineRepository.deleteRoutine(routineId, userId);
};
