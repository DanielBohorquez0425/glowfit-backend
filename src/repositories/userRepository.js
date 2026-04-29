import prisma from "../config/prismaClient.js";

export const incrementTokenVersion = async (userId) => {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { token_version: { increment: 1 } },
    select: { token_version: true },
  });
  return user.token_version;
};

export const findTokenVersionById = async (id) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { token_version: true },
  });
  return user?.token_version;
};

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
      level: true,
      created_at: true,
      updated_at: true,
      gym_memberships_gym_memberships_user_idTousers: {
        select: {
          gym_id: true,
          role: true,
          status: true,
          gyms: {
            select: {
              id: true,
              name: true,
              slug: true,
              logo_url: true,
              city: true,
            },
          },
        },
      },
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
  const { limit = 10, offset = 0, startDate, endDate, month } = options;

  const where = {
    user_id: userId,
  };

  if (startDate || endDate || month) {
    where.completed_at = {};

    if (month) {
      const year = new Date().getFullYear();
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

      where.completed_at.gte = monthStart;
      where.completed_at.lte = monthEnd;
    }

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
    },
  );
};

// ── Password Reset ────────────────────────────────────────────────────────────

export const createPasswordResetCode = async (userId, hashedCode) => {
  // Invalidar códigos anteriores del usuario
  await prisma.passwordResetCode.updateMany({
    where: { user_id: userId, used: false },
    data: { used: true },
  });

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos
  return await prisma.passwordResetCode.create({
    data: { user_id: userId, code: hashedCode, expires_at: expiresAt },
  });
};

export const findActiveResetCode = async (userId) => {
  return await prisma.passwordResetCode.findFirst({
    where: {
      user_id: userId,
      used: false,
      expires_at: { gt: new Date() },
    },
    orderBy: { created_at: "desc" },
  });
};

export const markResetCodeAsUsed = async (id) => {
  return await prisma.passwordResetCode.update({
    where: { id },
    data: { used: true },
  });
};

export const updatePassword = async (userId, hashedPassword) => {
  return await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });
};

// ─────────────────────────────────────────────────────────────────────────────

export const getWeeklyActivity = async (userId, week, year) => {
  // Calcular el inicio de la semana (lunes a las 00:00:00)
  const weekStart = getWeekStart(week, year);
  // Calcular el fin de la semana (domingo a las 23:59:59.999)
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  // Contar rutinas completadas en la semana
  const completedRoutines = await prisma.routine_completions.count({
    where: {
      user_id: userId,
      completed_at: {
        gte: weekStart,
        lte: weekEnd,
      },
    },
  });

  // Contar rutinas activas del usuario
  const activeRoutines = await prisma.routines.count({
    where: {
      user_id: userId,
      is_active: true,
    },
  });

  return {
    completedRoutines,
    activeRoutines,
    weekRange: {
      start: weekStart,
      end: weekEnd,
    },
  };
};

/**
 * Calcula el primer día (lunes) de una semana específica del año
 * Basado en ISO 8601: la semana 1 es la primera semana con un jueves
 */
const getWeekStart = (week, year) => {
  // Obtener el primer día del año
  const firstDayOfYear = new Date(year, 0, 1);

  // Calcular el día de la semana (0=domingo, 1=lunes, ..., 6=sábado)
  let dayOfWeek = firstDayOfYear.getDay();

  // Convertir a formato ISO (1=lunes, 7=domingo)
  dayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;

  // Calcular el lunes de la semana 1 (ISO 8601)
  const firstMonday = new Date(year, 0, 1);
  if (dayOfWeek <= 4) {
    // Si el primer día del año es lunes a jueves, la semana 1 empieza el lunes de esa semana
    firstMonday.setDate(1 - dayOfWeek + 1);
  } else {
    // Si es viernes a domingo, la semana 1 empieza el próximo lunes
    firstMonday.setDate(1 + (8 - dayOfWeek));
  }

  // Calcular el lunes de la semana solicitada
  const weekStart = new Date(firstMonday);
  weekStart.setDate(firstMonday.getDate() + (week - 1) * 7);
  weekStart.setHours(0, 0, 0, 0);

  return weekStart;
};
