import prisma from "../config/prismaClient.js";

export const create = async (data) => {
  return await prisma.refreshToken.create({
    data,
  });
};

export const findByToken = async (token) => {
  return await prisma.refreshToken.findUnique({
    where: { token },
    include: { user: true },
  });
};

export const deleteByToken = async (token) => {
  return await prisma.refreshToken.delete({
    where: { token },
  });
};

export const deleteAllByUserId = async (userId) => {
  return await prisma.refreshToken.deleteMany({
    where: { user_id: userId },
  });
};

export const deleteExpired = async () => {
  return await prisma.refreshToken.deleteMany({
    where: {
      expires_at: {
        lt: new Date(),
      },
    },
  });
};
