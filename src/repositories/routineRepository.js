import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const buildSetsCreate = (exercise) => {
  if (Array.isArray(exercise.sets)) {
    return exercise.sets.map((set, index) => ({
      set_number: set.set_number ?? index + 1,
      weight: set.weight,
      reps: set.reps,
      rest_time: set.rest_time,
    }));
  }

  const count = Number(exercise.sets) || 0;
  return Array.from({ length: count }, (_, index) => ({
    set_number: index + 1,
    weight: exercise.weight,
    reps: exercise.reps,
    rest_time: exercise.rest_time,
  }));
};

export const checkExistingRoutinesForDays = async (userId, dayIds) => {
  const existingRoutines = await prisma.routines.findFirst({
    where: {
      user_id: userId,
      deleted_at: null,
      routine_days: {
        some: {
          day_id: {
            in: dayIds,
          },
        },
      },
    },
  });

  return !!existingRoutines;
};

export const countUserRoutines = async (userId) => {
  return await prisma.routines.count({
    where: {
      user_id: userId,
      deleted_at: null,
    },
  });
};

export const createRoutine = async (data) => {
  const {
    name,
    description,
    user_id,
    estimated_duration,
    level,
    goal,
    is_active,
    days,
    exercises,
  } = data;

  return await prisma.routines.create({
    data: {
      name,
      description,
      user_id,
      estimated_duration,
      level,
      goal,
      is_active,
      routine_days: {
        create: days.map((dayId) => ({
          day_id: dayId,
        })),
      },
      routine_exercises: {
        create: exercises.map((exercise) => ({
          exercise_id: exercise.exercise_id,
          order_position: exercise.order_position,
          notes: exercise.notes,
          routine_exercise_sets: {
            create: buildSetsCreate(exercise),
          },
        })),
      },
    },
    include: {
      routine_days: true,
      routine_exercises: {
        include: {
          routine_exercise_sets: true,
        },
      },
    },
  });
};

export const getRoutineById = async (routineId) => {
  return await prisma.routines.findFirst({
    where: {
      id: routineId,
      deleted_at: null,
    },
    include: {
      routine_days: true,
      routine_exercises: {
        include: {
          routine_exercise_sets: true,
        },
      },
    },
  });
};

export const getRoutinesByUserId = async (userId) => {
  return await prisma.routines.findMany({
    where: {
      user_id: userId,
      deleted_at: null,
    },
    include: {
      routine_days: true,
      routine_exercises: {
        include: {
          routine_exercise_sets: true,
        },
      },
    },
  });
};

export const markRoutineAsCompleted = async (routineId, userId) => {
  const completedAt = new Date();
  const dayOfWeek = completedAt.getDay() === 0 ? 7 : completedAt.getDay();

  return await prisma.routines.update({
    where: {
      id: routineId,
    },
    data: {
      is_completed: true,
      completed_at: completedAt,
      routine_completions: {
        create: {
          user_id: userId,
          completed_at: completedAt,
          day_of_week: dayOfWeek,
        },
      },
    },
    include: {
      routine_completions: {
        orderBy: {
          completed_at: "desc",
        },
        take: 1,
      },
    },
  });
};

export const updateRoutine = async (id, data) => {
  const {
    name,
    description,
    estimated_duration,
    level,
    goal,
    is_active,
    days,
    exercises,
    routine_days, // Alias support
    routine_exercises, // Alias support
  } = data;

  // Normalize days: use 'days' if present, otherwise map from 'routine_days', or default to empty array
  const daysToProcess = days
    ? days
    : routine_days
    ? routine_days.map((d) => (typeof d === "object" ? d.day_id : d))
    : [];

  // Normalize exercises: use 'exercises' if present, otherwise 'routine_exercises', or default to empty array
  const exercisesToProcess = exercises || routine_exercises || [];

  return await prisma.routines.update({
    where: { id },
    data: {
      name,
      description,
      estimated_duration,
      level,
      goal,
      is_active,
      // Replace routine days
      routine_days: {
        deleteMany: {}, // Delete existing relations
        create: daysToProcess.map((dayId) => ({
          day_id: dayId,
        })),
      },
      // Replace routine exercises (cascade removes their old sets)
      routine_exercises: {
        deleteMany: {}, // Delete existing relations
        create: exercisesToProcess.map((exercise) => ({
          exercise_id: exercise.exercise_id,
          order_position: exercise.order_position,
          notes: exercise.notes,
          routine_exercise_sets: {
            create: buildSetsCreate(exercise),
          },
        })),
      },
    },
    include: {
      routine_days: true,
      routine_exercises: {
        include: {
          routine_exercise_sets: true,
        },
      },
    },
  });
};

export const deleteRoutine = async (routineId, userId) => {
  const routine = await prisma.routines.findFirst({
    where: {
      id: routineId,
      deleted_at: null,
    },
  });

  if (!routine) {
    throw new Error("Rutina no encontrada");
  }

  if (routine.user_id !== userId) {
    throw new Error("No tienes permisos para eliminar esta rutina");
  }

  return await prisma.routines.update({
    where: {
      id: routineId,
    },
    data: {
      deleted_at: new Date(),
    },
  });
};
