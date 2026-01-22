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
