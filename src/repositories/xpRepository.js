import prisma from "../config/prismaClient.js";

export const createXpTransaction = async (data) => {
  const { user_id, xp_amount, action_type, routine_completion_id, metadata } =
    data;

  return await prisma.xp_transactions.create({
    data: {
      user_id,
      xp_amount,
      action_type,
      routine_completion_id,
      metadata,
    },
  });
};

export const getUserXpTransactions = async (userId, options = {}) => {
  const { limit = 50, offset = 0, startDate, endDate } = options;

  const where = {
    user_id: userId,
  };

  if (startDate || endDate) {
    where.created_at = {};
    if (startDate) {
      where.created_at.gte = new Date(startDate);
    }
    if (endDate) {
      where.created_at.lte = new Date(endDate);
    }
  }

  const [transactions, total] = await Promise.all([
    prisma.xp_transactions.findMany({
      where,
      orderBy: {
        created_at: "desc",
      },
      take: parseInt(limit),
      skip: parseInt(offset),
    }),
    prisma.xp_transactions.count({ where }),
  ]);

  return { transactions, total };
};

export const countRecentCompletions = async (userId, actionType, minutes) => {
  const timeThreshold = new Date(Date.now() - minutes * 60 * 1000);

  return await prisma.xp_transactions.count({
    where: {
      user_id: userId,
      action_type: actionType,
      created_at: {
        gte: timeThreshold,
      },
    },
  });
};

export const updateUserXp = async (userId, xpAmount, newLevel) => {
  return await prisma.user.update({
    where: { id: userId },
    data: {
      xp: xpAmount,
      level: newLevel,
    },
    select: {
      id: true,
      email: true,
      name: true,
      last_name: true,
      xp: true,
      level: true,
    },
  });
};

export const getUserXpData = async (userId) => {
  return await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      xp: true,
      level: true,
    },
  });
};
