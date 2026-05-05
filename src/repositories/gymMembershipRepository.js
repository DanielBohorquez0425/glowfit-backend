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

export const updateMembershipGymRole = async (membershipId, gymRole) => {
  return await prisma.gym_memberships.update({
    where: { id: membershipId },
    data: { active_role: gymRole },
  });
};

export const addGymRole = async (membershipId, role) => {
  return await prisma.gym_memberships.update({
    where: { id: membershipId },
    data: { gym_roles: { push: role } },
  });
};

export const removeGymRole = async (membershipId, role) => {
  const membership = await prisma.gym_memberships.findUnique({
    where: { id: membershipId },
    select: { gym_roles: true, active_role: true },
  });

  if (!membership) throw new Error("MEMBERSHIP_NOT_FOUND");

  const updatedRoles = membership.gym_roles.filter((r) => r !== role);

  if (updatedRoles.length === 0) {
    throw new Error("CANNOT_REMOVE_LAST_ROLE");
  }

  const newActiveRole = updatedRoles.includes(membership.active_role)
    ? membership.active_role
    : updatedRoles[0];

  return await prisma.gym_memberships.update({
    where: { id: membershipId },
    data: {
      gym_roles: updatedRoles,
      active_role: newActiveRole,
    },
  });
};

export const setActiveRole = async (membershipId, role) => {
  const membership = await prisma.gym_memberships.findUnique({
    where: { id: membershipId },
    select: { gym_roles: true },
  });

  if (!membership) throw new Error("MEMBERSHIP_NOT_FOUND");

  if (!membership.gym_roles.includes(role)) {
    throw new Error("ROLE_NOT_IN_MEMBERSHIP");
  }

  return await prisma.gym_memberships.update({
    where: { id: membershipId },
    data: { active_role: role },
  });
};
