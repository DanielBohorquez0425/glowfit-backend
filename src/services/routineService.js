import * as routineRepository from "../repositories/routineRepository.js";

// Validates a single series. reps must be positive; weight/rest_time
// (when provided) must not be negative.
const validateSet = ({ reps, weight, rest_time }) => {
  if (reps != null && reps <= 0) throw new Error("INVALID_SET");
  if (weight != null && weight < 0) throw new Error("INVALID_SET");
  if (rest_time != null && rest_time < 0) throw new Error("INVALID_SET");
};

// Validates the series of every exercise. Handles both the manual shape
// (sets is an array of series) and the AI shape (sets is a count with
// scalar reps/weight/rest_time).
const validateExercises = (exercises = []) => {
  for (const exercise of exercises) {
    if (Array.isArray(exercise.sets)) {
      exercise.sets.forEach(validateSet);
    } else if (exercise.sets != null) {
      validateSet({
        reps: exercise.reps,
        weight: exercise.weight,
        rest_time: exercise.rest_time,
      });
    }
  }
};

export const createRoutine = async (data) => {
  // Aquí se pueden agregar validaciones adicionales si es necesario
  if (!data.name || !data.user_id) {
    throw new Error("El nombre y el ID de usuario son obligatorios");
  }

  const days = data.days ?? [];
  if (days.length === 0) {
    throw new Error("Debes seleccionar al menos un día");
  }

  validateExercises(data.exercises);

  // Cada día se materializa como una rutina independiente, por lo que el
  // límite de 15 debe contemplar todas las rutinas que se van a crear.
  const routineCount = await routineRepository.countUserRoutines(data.user_id);
  if (routineCount + days.length > 15) {
    throw new Error("Has alcanzado el límite máximo de 15 rutinas");
  }

  // Crear una rutina independiente por cada día seleccionado. Esto mantiene la
  // regla de negocio "una rutina activa por día", ya que is_active vive en la
  // fila de la rutina y ahora cada rutina pertenece a un único día.
  const createdRoutines = [];
  for (const dayId of days) {
    let isActive = data.is_active;

    // Si no se especificó is_active, activarla solo cuando no haya otra rutina
    // en ese día.
    if (isActive === undefined) {
      const hasExistingRoutines =
        await routineRepository.checkExistingRoutinesForDays(data.user_id, [
          dayId,
        ]);
      isActive = !hasExistingRoutines;
    }

    const routine = await routineRepository.createRoutine({
      ...data,
      days: [dayId],
      is_active: isActive,
    });
    createdRoutines.push(routine);
  }

  return createdRoutines;
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

  validateExercises(data.exercises || data.routine_exercises);

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
