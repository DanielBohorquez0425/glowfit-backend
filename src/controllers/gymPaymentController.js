import * as gymPaymentService from "../services/gymPaymentService.js";

const fullName = (user) =>
  user ? [user.name, user.last_name].filter(Boolean).join(" ").trim() || user.email : null;

/** Serializa un movimiento de Caja. `amount` es Decimal en Prisma. */
const mapPayment = (payment) => ({
  id: payment.id,
  user_id: payment.user_id,
  user_name: fullName(payment.users),
  user_email: payment.users?.email ?? null,
  plan_id: payment.plan_id,
  plan_name: payment.plan_name,
  amount: Number(payment.amount),
  currency: payment.currency,
  start_date: payment.start_date,
  end_date: payment.end_date,
  payment_method: payment.payment_method,
  paid_at: payment.paid_at,
  registered_by_name: fullName(payment.registrant),
  notes: payment.notes,
});

/**
 * POST /gyms/:gymId/members/:userId/plan
 *
 * Activa un plan para un socio: registra el pago y extiende su vigencia.
 * Solo GYM_ADMIN del gym.
 *
 * Body:
 *   { planId, startDate?, amount?, paymentMethod?, notes? }
 *
 * Si el socio renueva estando vigente, la nueva vigencia se encadena a su
 * vencimiento actual y no pierde los días ya pagados.
 */
export const assignPlan = async (req, res) => {
  try {
    const { gymId, userId } = req.params;
    const { planId, startDate, amount, paymentMethod, notes } = req.body;

    const { payment, membership } = await gymPaymentService.assignPlan(gymId, userId, {
      planId,
      startDate,
      amount,
      paymentMethod,
      notes,
      registeredBy: req.user.userId,
    });

    res.status(201).json({
      success: true,
      data: {
        payment: {
          id: payment.id,
          plan_name: payment.plan_name,
          amount: Number(payment.amount),
          currency: payment.currency,
          payment_method: payment.payment_method,
          paid_at: payment.paid_at,
        },
        membership: {
          id: membership.id,
          plan_id: membership.plan_id,
          plan: membership.plan,
          status: membership.status,
          start_date: membership.start_date,
          end_date: membership.end_date,
        },
      },
    });
  } catch (error) {
    if (error.message === "PLAN_ID_REQUIRED") {
      return res.status(400).json({ error: "'planId' es obligatorio." });
    }
    if (error.message === "INVALID_PAYMENT_METHOD") {
      return res.status(400).json({
        error: `Método de pago inválido. Valores permitidos: ${gymPaymentService.VALID_PAYMENT_METHODS.join(", ")}.`,
      });
    }
    if (error.message === "INVALID_START_DATE") {
      return res.status(400).json({ error: "'startDate' debe tener el formato YYYY-MM-DD." });
    }
    if (error.message === "INVALID_AMOUNT") {
      return res.status(400).json({ error: "'amount' debe ser un número mayor o igual a 0." });
    }
    if (error.message === "MEMBERSHIP_NOT_FOUND") {
      return res.status(404).json({ error: "El usuario no pertenece a este gimnasio." });
    }
    if (error.message === "PLAN_NOT_FOUND" || error.code === "P2025") {
      return res.status(404).json({ error: "No se encontró el plan." });
    }
    if (error.message === "PLAN_INACTIVE") {
      return res.status(400).json({ error: "El plan está archivado y no se puede asignar." });
    }
    console.error("Error al asignar el plan al socio:", error);
    res.status(500).json({ error: "Error interno al asignar el plan." });
  }
};

/**
 * GET /gyms/:gymId/payments
 *
 * Movimientos de Caja del gym. Solo GYM_ADMIN del gym.
 *
 * Query params:
 *   - range (default: all) — all | 1m | 3m | 1y
 *   - page (default: 1)
 *   - limit (default: 20, max: 100)
 *
 * `summary.total` corresponde al rango completo, no a la página devuelta.
 */
export const listPayments = async (req, res) => {
  try {
    const { gymId } = req.params;
    const range = req.query.range || "all";

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const { payments, total, summary } = await gymPaymentService.listPayments(gymId, {
      range,
      limit,
      offset,
    });

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: payments.map(mapPayment),
      summary: { ...summary, range },
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    if (error.message === "INVALID_RANGE") {
      return res.status(400).json({
        error: `Rango inválido. Valores permitidos: ${gymPaymentService.VALID_RANGES.join(", ")}.`,
      });
    }
    console.error("Error al obtener los movimientos de caja:", error);
    res.status(500).json({ error: "Error interno al obtener los movimientos de caja." });
  }
};
