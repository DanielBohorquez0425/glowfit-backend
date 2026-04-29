import prisma from "../config/prismaClient.js";

export const createMembership = async (data) => {
  return await prisma.gym_memberships.create({ data });
};

export const findMembershipByUserId = async (user_id) => {
  return await prisma.gym_memberships.findUnique({
    where: { user_id },
    include: {
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
  });
};

export const findMembersByGymId = async (gym_id) => {
  return await prisma.gym_memberships.findMany({
    where: { gym_id },
    include: {
      users_gym_memberships_user_idTousers: {
        select: {
          id: true,
          name: true,
          last_name: true,
          email: true,
          gender: true,
          level: true,
        },
      },
    },
    orderBy: { created_at: "desc" },
  });
};
