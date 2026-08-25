import prisma from "../config/prismaClient.js";

export const sendInvitation = async (data) => {
  return await prisma.gym_invitations.create({ data });
};

export const findUniqueInvitation = async (email, gym_id) => {
  return await prisma.gym_invitations.findUnique({
    where: {
      email_gym_id: { email: email, gym_id: gym_id },
    },
  });
};

export const findInvitationById = async (id) => {
  return await prisma.gym_invitations.findUnique({
    where: { id },
  });
};

export const acceptInvitation = async (id) => {
  return await prisma.gym_invitations.update({
    where: { id },
    data: { status: "ACCEPTED" },
  });
};

export const getInvitationByUserEmail = async (email) => {
  return await prisma.gym_invitations.findMany({
    where: { email },
    include: { gyms: true },
  });
};

export const findInvitationsByGymId = async (gym_id, { status, limit } = {}) => {
  return await prisma.gym_invitations.findMany({
    where: { gym_id, ...(status ? { status } : {}) },
    orderBy: { created_at: "desc" },
    ...(limit ? { take: limit } : {}),
  });
};

export const countInvitationsByStatus = async (gym_id) => {
  return await prisma.gym_invitations.groupBy({
    by: ["status"],
    where: { gym_id },
    _count: { _all: true },
  });
};
