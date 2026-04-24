import prisma from "../config/prismaClient.js";

export const sendInvitation = async (data) => {
  return await prisma.gym_invitations.create({ data });
};

export const findUniqueInvitation = async (email, gym_id) => {
  return await prisma.gym_invitations.findUnique({
    where: {
      unique_invitation_per_gym: { email: email, gym_id: gym_id },
    },
  });
};
