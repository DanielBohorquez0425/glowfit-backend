import * as gymPaymentRepository from "../repositories/gymPaymentRepository.js";
import * as gymPlanRepository from "../repositories/gymPlanRepository.js";
import * as gymMembershipRepository from "../repositories/gymMembershipRepository.js";
import {
  calculateEndDate,
  resolveStartDate,
  toDateOnly,
  todayInGymTz,
} from "../utils/planDates.js";

export const VALID_PAYMENT_METHODS = ["CASH", "CARD", "TRANSFER", "OTHER"];
export const VALID_RANGES = ["all", "1m", "3m", "1y"];

/** Meses que abarca cada rango de Caja. `all` no acota. */
const RANGE_MONTHS = { "1m": 1, "3m": 3, "1y": 12 };

/**
 * Activa un plan para un socio: registra el pago y extiende su vigencia.
 *
 * La vigencia se encadena. Si el socio renueva estando vigente, la nueva
 * vigencia arranca el día siguiente a su vencimiento actual, así no pierde los
 * días que ya pagó. Si ya venció, arranca hoy.
 *
 * `plan_name` y `amount` se guardan como snapshot en el pago: si el gym cambia
 * el precio del plan más adelante, el historial de Caja no se altera.
 *
 * La autorización (GYM_ADMIN del gym) se hace en el middleware.
 *
 * @param {string} gymId
 * @param {string} userId - Socio al que se le activa el plan
 * @param {Object} input
 * @param {string} input.planId
 * @param {string} [input.startDate] - YYYY-MM-DD; por defecto se encadena o es hoy
 * @param {number} [input.amount] - Importe cobrado; por defecto el precio del plan
 * @param {string} [input.paymentMethod] - CASH por defecto
 * @param {string} [input.notes]
 * @param {string} [input.registeredBy] - Admin que registra el cobro
 * @returns {{ payment: Object, membership: Object }}
 */
export const assignPlan = async (gymId, userId, input) => {
  const { planId, startDate, amount, paymentMethod = "CASH", notes, registeredBy } = input;

  if (!planId) throw new Error("PLAN_ID_REQUIRED");
  if (!VALID_PAYMENT_METHODS.includes(paymentMethod)) {
    throw new Error("INVALID_PAYMENT_METHOD");
  }

  const membership = await gymMembershipRepository.findMembershipByUserId(userId);
  if (!membership || membership.gym_id !== gymId) throw new Error("MEMBERSHIP_NOT_FOUND");

  const plan = await gymPlanRepository.findById(planId);
  if (!plan || plan.gym_id !== gymId) throw new Error("PLAN_NOT_FOUND");
  if (!plan.is_active) throw new Error("PLAN_INACTIVE");

  const today = todayInGymTz();

  let resolvedStart;
  if (startDate !== undefined) {
    resolvedStart = toDateOnly(startDate);
    if (!resolvedStart) throw new Error("INVALID_START_DATE");
  } else {
    resolvedStart = resolveStartDate(membership.end_date, today);
  }

  const resolvedEnd = calculateEndDate(
    resolvedStart,
    plan.duration_value,
    plan.duration_unit,
  );

  let resolvedAmount = Number(plan.price);
  if (amount !== undefined) {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed < 0) throw new Error("INVALID_AMOUNT");
    resolvedAmount = Math.round(parsed * 100) / 100;
  }

  return await gymPaymentRepository.createPaymentWithMembershipUpdate(
    {
      gym_id: gymId,
      membership_id: membership.id,
      user_id: userId,
      plan_id: plan.id,
      plan_name: plan.name,
      amount: resolvedAmount,
      currency: plan.currency,
      start_date: resolvedStart,
      end_date: resolvedEnd,
      payment_method: paymentMethod,
      registered_by: registeredBy ?? null,
      notes: notes?.trim() || null,
    },
    {
      membershipId: membership.id,
      data: {
        plan_id: plan.id,
        // Snapshot del nombre para que los endpoints que ya leen `plan` sigan andando.
        plan: plan.name,
        start_date: resolvedStart,
        end_date: resolvedEnd,
        status: "ACTIVE",
        updated_at: new Date(),
      },
    },
  );
};

/**
 * Fecha desde la que se cuentan los pagos de un rango de Caja.
 *
 * @param {string} range - all | 1m | 3m | 1y
 * @returns {Date|undefined} undefined para `all`
 */
const resolveRangeStart = (range) => {
  const months = RANGE_MONTHS[range];
  if (!months) return undefined;

  const from = new Date();
  from.setMonth(from.getMonth() - months);
  return from;
};

/**
 * Movimientos de Caja del gym, con el total del rango completo.
 *
 * El total sale de un `aggregate` sobre todo el rango, no de sumar la página
 * actual: paginar no puede cambiar el total que ve el admin.
 *
 * @param {string} gymId
 * @param {Object} options
 * @param {string} options.range - all | 1m | 3m | 1y
 * @param {number} options.limit
 * @param {number} options.offset
 * @returns {{ payments: Array, total: number, summary: { total: number, count: number } }}
 */
export const listPayments = async (gymId, { range = "all", limit = 20, offset = 0 } = {}) => {
  if (!VALID_RANGES.includes(range)) throw new Error("INVALID_RANGE");

  const from = resolveRangeStart(range);

  const [{ payments, total }, summary] = await Promise.all([
    gymPaymentRepository.findByGymId(gymId, { from, limit, offset }),
    gymPaymentRepository.sumByGymId(gymId, { from }),
  ]);

  return { payments, total, summary };
};
