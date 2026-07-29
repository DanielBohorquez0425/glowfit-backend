/**
 * Utilidades de fechas para vigencias de planes.
 *
 * Las columnas `start_date` / `end_date` son `@db.Date` (sin hora). Para evitar
 * corrimientos de un día se trabaja siempre con fechas UTC a medianoche y con
 * el día calendario de la zona del gimnasio (America/Bogota, UTC-5 fijo).
 *
 * `end_date` es el ÚLTIMO día de vigencia (inclusive).
 */

/** Offset fijo de America/Bogota (UTC-5). Colombia no usa horario de verano. */
const GYM_TZ_OFFSET_MINUTES = -5 * 60;

/** Fecha UTC a medianoche a partir de sus componentes. */
const utcDate = (year, month, day) => new Date(Date.UTC(year, month, day));

/**
 * Día calendario de hoy en la zona del gimnasio, como fecha UTC a medianoche.
 *
 * @returns {Date}
 */
export const todayInGymTz = () => {
  const shifted = new Date(Date.now() + GYM_TZ_OFFSET_MINUTES * 60 * 1000);
  return utcDate(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
};

/**
 * Normaliza un valor de fecha a fecha UTC a medianoche.
 * Acepta `Date` o string `YYYY-MM-DD`.
 *
 * @param {Date|string} value
 * @returns {Date|null} null si el valor no es una fecha válida
 */
export const toDateOnly = (value) => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return utcDate(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  }

  if (typeof value === "string") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (!match) return null;

    const [, year, month, day] = match.map(Number);
    const date = utcDate(year, month - 1, day);

    // Rechaza fechas inexistentes como 2026-02-31, que Date normalizaría a marzo.
    if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return date;
  }

  return null;
};

/** Suma días a una fecha UTC a medianoche. */
export const addDays = (date, days) =>
  utcDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days);

/**
 * Suma meses conservando el día del mes, con clamping al último día del mes
 * destino: 31-ene + 1 mes = 28-feb (no 3-mar).
 */
export const addMonths = (date, months) => {
  const day = date.getUTCDate();
  const target = utcDate(date.getUTCFullYear(), date.getUTCMonth() + months, 1);
  const lastDayOfTargetMonth = utcDate(
    target.getUTCFullYear(),
    target.getUTCMonth() + 1,
    0,
  ).getUTCDate();

  return utcDate(
    target.getUTCFullYear(),
    target.getUTCMonth(),
    Math.min(day, lastDayOfTargetMonth),
  );
};

/**
 * Último día de vigencia (inclusive) de un plan que arranca en `startDate`.
 *
 * Un plan de 1 mes comprado el 29-jul vence el 29-ago: se usa el mismo día
 * calendario del mes siguiente, que es cómo la gente cuenta los meses.
 * Los planes por día sí restan 1 (un pase diario vence el mismo día).
 *
 * @param {Date} startDate - Fecha UTC a medianoche
 * @param {number} durationValue
 * @param {"DAY"|"WEEK"|"MONTH"|"YEAR"} durationUnit
 * @returns {Date}
 */
export const calculateEndDate = (startDate, durationValue, durationUnit) => {
  switch (durationUnit) {
    case "DAY":
      return addDays(startDate, durationValue - 1);
    case "WEEK":
      return addDays(startDate, durationValue * 7 - 1);
    case "MONTH":
      return addMonths(startDate, durationValue);
    case "YEAR":
      return addMonths(startDate, durationValue * 12);
    default:
      throw new Error("INVALID_DURATION_UNIT");
  }
};

/**
 * Fecha de inicio de una nueva vigencia.
 *
 * Si la membresía sigue vigente, la nueva vigencia se encadena al día siguiente
 * del vencimiento actual para que el socio no pierda los días que ya pagó.
 * Si ya venció (o nunca tuvo vigencia), arranca hoy.
 *
 * Una membresía sin `end_date` es una membresía sin vencimiento (dato heredado):
 * en ese caso también arranca hoy, porque no hay nada que encadenar.
 *
 * @param {Date|null} currentEndDate
 * @param {Date} today
 * @returns {Date}
 */
export const resolveStartDate = (currentEndDate, today) => {
  if (!currentEndDate) return today;

  const currentEnd = toDateOnly(currentEndDate);
  if (!currentEnd || currentEnd < today) return today;

  return addDays(currentEnd, 1);
};

/**
 * Una membresía está activa si su estado es ACTIVE y su vigencia cubre hoy.
 * `end_date` nulo significa sin vencimiento (socios previos a los planes).
 *
 * @param {{ status: string, end_date: Date|null }} membership
 * @param {Date} [today]
 * @returns {boolean}
 */
export const isMembershipActive = (membership, today = todayInGymTz()) => {
  if (membership.status !== "ACTIVE") return false;
  if (!membership.end_date) return true;

  const endDate = toDateOnly(membership.end_date);
  return endDate !== null && endDate >= today;
};
