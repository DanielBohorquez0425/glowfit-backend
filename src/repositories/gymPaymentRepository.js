import prisma from "../config/prismaClient.js";

const paymentUserSelect = {
  select: {
    id: true,
    email: true,
    name: true,
    last_name: true,
  },
};

/**
 * Registra un pago y actualiza la vigencia de la membresía de forma atómica.
 * Si algo falla, no queda un cobro sin vigencia ni una vigencia sin cobro.
 *
 * @param {Object} payment - Fila del libro de pagos
 * @param {Object} membershipUpdate
 * @param {string} membershipUpdate.membershipId
 * @param {Object} membershipUpdate.data - plan_id, plan, start_date, end_date, status
 * @returns {{ payment: Object, membership: Object }}
 */
export const createPaymentWithMembershipUpdate = async (
  payment,
  { membershipId, data },
) => {
  return await prisma.$transaction(async (tx) => {
    const createdPayment = await tx.gym_plan_payments.create({ data: payment });

    const membership = await tx.gym_memberships.update({
      where: { id: membershipId },
      data,
    });

    return { payment: createdPayment, membership };
  });
};

/**
 * Lista los pagos de un gym con paginación.
 * Los pagos anulados quedan fuera: la Caja muestra dinero real.
 *
 * @param {string} gymId
 * @param {Object} options
 * @param {Date} [options.from] - Filtra por `paid_at` desde esta fecha
 * @param {number} options.limit
 * @param {number} options.offset
 * @returns {{ payments: Array, total: number }}
 */
export const findByGymId = async (gymId, { from, limit = 20, offset = 0 } = {}) => {
  const where = { gym_id: gymId, voided_at: null };
  if (from) where.paid_at = { gte: from };

  const [payments, total] = await Promise.all([
    prisma.gym_plan_payments.findMany({
      where,
      include: { users: paymentUserSelect, registrant: paymentUserSelect },
      orderBy: { paid_at: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.gym_plan_payments.count({ where }),
  ]);

  return { payments, total };
};

/**
 * Suma de los pagos del rango completo, no de la página actual.
 *
 * @param {string} gymId
 * @param {Date} [from]
 * @returns {{ total: number, count: number }}
 */
export const sumByGymId = async (gymId, { from } = {}) => {
  const where = { gym_id: gymId, voided_at: null };
  if (from) where.paid_at = { gte: from };

  const result = await prisma.gym_plan_payments.aggregate({
    where,
    _sum: { amount: true },
    _count: { _all: true },
  });

  return {
    total: Number(result._sum.amount ?? 0),
    count: result._count._all,
  };
};
