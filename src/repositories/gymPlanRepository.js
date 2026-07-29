import prisma from "../config/prismaClient.js";

export const findByGymId = async (gymId, { includeInactive = false } = {}) => {
  const where = { gym_id: gymId };
  if (!includeInactive) where.is_active = true;

  return await prisma.gym_plans.findMany({
    where,
    orderBy: [{ is_active: "desc" }, { price: "asc" }],
  });
};

export const findById = async (id) => {
  return await prisma.gym_plans.findUnique({ where: { id } });
};

export const createPlan = async (data) => {
  return await prisma.gym_plans.create({ data });
};

export const updatePlan = async (id, data) => {
  return await prisma.gym_plans.update({ where: { id }, data });
};

export const deactivatePlan = async (id) => {
  return await prisma.gym_plans.update({
    where: { id },
    data: { is_active: false },
  });
};

export const deletePlan = async (id) => {
  return await prisma.gym_plans.delete({ where: { id } });
};

export const countPayments = async (planId) => {
  return await prisma.gym_plan_payments.count({ where: { plan_id: planId } });
};

/** Cantidad de socios que hoy tienen este plan asignado en su membresía. */
export const countMemberships = async (planId) => {
  return await prisma.gym_memberships.count({ where: { plan_id: planId } });
};
