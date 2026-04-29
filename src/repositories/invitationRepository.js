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
