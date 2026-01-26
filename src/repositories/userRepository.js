import prisma from "../config/prismaClient.js";

export const findByEmail = async (email) => {
  return await prisma.user.findUnique({
    where: { email },
  });
};

export const create = async (data) => {
  return await prisma.user.create({
    data,
  });
};

export const findById = async (id) => {
  return await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      last_name: true,
      date_of_birth: true,
      weight: true,
      height: true,
      bmi: true,
      gender: true,
      xp: true,
      level: true,
      created_at: true,
      updated_at: true,
    },
  });
};

export const findAll = async () => {
  return await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      last_name: true,
      date_of_birth: true,
      weight: true,
      height: true,
      bmi: true,
      gender: true,
      xp: true,
      level: true,
      created_at: true,
      updated_at: true,
    },
  });
};

export const update = async (id, data) => {
  const { user_training_days, ...userData } = data;

  const updateData = { ...userData };

  if (user_training_days) {
    updateData.user_training_days = {
      deleteMany: {},
      create: user_training_days.create || [],
    };
  }
  return await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      email: true,
      name: true,
      last_name: true,
      date_of_birth: true,
      weight: true,
      height: true,
      bmi: true,
      gender: true,
      xp: true,
      level: true,
      created_at: true,
      updated_at: true,
      role: true,
      goal_id: true,
      user_training_days: {
        select: {
          day_id: true,
          day: true,
        },
      },
      has_disability: true,
      disability_description: true,
    },
  });
};

export const getUserActivity = async (userId, options = {}) => {
  const { limit = 10, offset = 0, startDate, endDate } = options;

  const where = {
    user_id: userId,
  };

  // Filtros de fecha opcionales
  if (startDate || endDate) {
    where.completed_at = {};
    if (startDate) {
      where.completed_at.gte = new Date(startDate);
    }
    if (endDate) {
      where.completed_at.lte = new Date(endDate);
    }
  }

  const [completions, total] = await Promise.all([
    prisma.routine_completions.findMany({
      where,
      include: {
        routine: {
          select: {
            id: true,
            name: true,
            description: true,
            estimated_duration: true,
            level: true,
            goal: true,
          },
        },
      },
      orderBy: {
        completed_at: "desc",
      },
      take: parseInt(limit),
      skip: parseInt(offset),
    }),
    prisma.routine_completions.count({ where }),
  ]);

  return { completions, total };
};

/**
 * Activa una rutina específica para un día, desactivando todas las demás rutinas
 * activas del usuario para ese mismo día. Operación atómica con transacción.
 */
export const setActiveRoutineForDay = async (userId, day, routineId) => {
  return await prisma.$transaction(
    async (tx) => {
      // 1. Validar que la rutina existe, pertenece al usuario y tiene el día asignado
      const routine = await tx.routines.findFirst({
        where: {
          id: routineId,
          user_id: userId,
        },
        include: {
          routine_days: {
            where: { day_id: day },
          },
        },
      });

      if (!routine) {
        throw new Error("ROUTINE_NOT_FOUND");
      }

      if (routine.routine_days.length === 0) {
        throw new Error("ROUTINE_NOT_ASSIGNED_TO_DAY");
      }

      // 2. Obtener todas las rutinas del usuario que tienen este día asignado
      const routinesForDay = await tx.routines.findMany({
        where: {
          user_id: userId,
          routine_days: {
            some: { day_id: day },
          },
        },
        select: {
          id: true,
          is_active: true,
        },
      });

      const routineIdsToDeactivate = routinesForDay
        .filter((r) => r.id !== routineId && r.is_active === true)
        .map((r) => r.id);

      // 3. Desactivar todas las rutinas activas para este día (excepto la que activaremos)
      if (routineIdsToDeactivate.length > 0) {
        await tx.routines.updateMany({
          where: {
            id: { in: routineIdsToDeactivate },
          },
          data: {
            is_active: false,
            updated_at: new Date(),
          },
        });
      }

      // 4. Activar la rutina indicada
      await tx.routines.update({
        where: { id: routineId },
        data: {
          is_active: true,
          updated_at: new Date(),
        },
      });

      // 5. Construir la lista de rutinas afectadas
      const affectedRoutines = routinesForDay.map((r) => ({
        id: r.id,
        isActive: r.id === routineId,
      }));

      return {
        day,
        activatedRoutineId: routineId,
        affectedRoutines,
      };
    },
    {
      isolationLevel: "Serializable",
    }
  );
};
