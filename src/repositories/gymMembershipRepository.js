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

export const assignTrainer = async (membershipId, trainerId) => {
  return await prisma.gym_memberships.update({
    where: { id: membershipId },
    data: { trainer_id: trainerId },
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

export const setGymRoles = async (membershipId, roles, activeRole) => {
  return await prisma.gym_memberships.update({
    where: { id: membershipId },
    data: { gym_roles: roles, active_role: activeRole },
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

/**
 * Lista usuarios de un gym con paginación y filtro por rol.
 *
 * @param {string} gymId - ID del gym
 * @param {Object} options
 * @param {number} options.limit - Cantidad por página
 * @param {number} options.offset - Offset para paginación
 * @param {string} [options.role] - Filtrar por GymRole (ej: 'TRAINER', 'MEMBER')
 * @param {string} [options.trainerId] - Filtrar por entrenador asignado
 * @returns {{ users: Array, total: number }}
 */
export const findUsersByGymId = async (gymId, options = {}) => {
  const { limit = 20, offset = 0, role, trainerId } = options;

  const where = { gym_id: gymId };

  // Se filtra por `gym_roles` y no por `active_role`: el rol activo es el
  // sombrero que el usuario tiene puesto en la app, no la capacidad que tiene.
  // Un entrenador que hoy entrena como miembro sigue siendo entrenador.
  if (role) {
    where.gym_roles = { has: role };
  }

  if (trainerId) {
    where.trainer_id = trainerId;
  }

  const [memberships, total] = await Promise.all([
    prisma.gym_memberships.findMany({
      where,
      select: {
        id: true,
        active_role: true,
        gym_roles: true,
        status: true,
        plan: true,
        plan_id: true,
        start_date: true,
        end_date: true,
        created_at: true,
        trainer_id: true,
        users_gym_memberships_user_idTousers: {
          select: {
            id: true,
            email: true,
            name: true,
            last_name: true,
            gender: true,
            level: true,
            date_of_birth: true,
            height: true,
            weight: true,
            goal_id: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.gym_memberships.count({ where }),
  ]);

  // Aplanar la estructura para que el user quede al nivel raíz
  const users = memberships.map((m) => ({
    membership_id: m.id,
    active_role: m.active_role,
    gym_roles: m.gym_roles,
    status: m.status,
    plan: m.plan,
    plan_id: m.plan_id,
    start_date: m.start_date,
    end_date: m.end_date,
    member_since: m.created_at,
    trainer_id: m.trainer_id,
    ...m.users_gym_memberships_user_idTousers,
  }));

  return { users, total };
};

export const countNewMembersByDateRange = async (gymId, from, to) => {
  return await prisma.gym_memberships.count({
    where: {
      gym_id: gymId,
      active_role: "MEMBER",
      created_at: { gte: from, lte: to },
    },
  });
};
