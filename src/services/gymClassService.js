import * as gymClassRepository from "../repositories/gymClassRepository.js";
import * as gymClassEnrollmentRepository from "../repositories/gymClassEnrollmentRepository.js";
import * as gymRepository from "../repositories/gymRepository.js";
import * as gymMembershipRepository from "../repositories/gymMembershipRepository.js";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 62;
const MINUTES_PER_DAY = 1440;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const UPDATABLE_FIELDS = [
  "activity",
  "name",
  "room",
  "color",
  "start_minutes",
  "duration_minutes",
  "capacity",
];

// Dates are parsed as UTC midnight so the @db.Date column round-trips
// without timezone drift between server and clients.
const parseDate = (value) => {
  if (typeof value !== "string" || !DATE_REGEX.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const DEFAULT_TIMEZONE = "America/Bogota";

// start_minutes is stored in the gym's local time and class_date is a UTC
// midnight @db.Date, so compare both against "now" expressed in the gym's zone.
const localDateAndMinutes = (timezone, now) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone || DEFAULT_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map(({ type, value }) => [type, value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
};

export const hasClassStarted = (cls, now = new Date()) => {
  const local = localDateAndMinutes(cls.gyms?.timezone, now);
  const classDate = cls.class_date.toISOString().slice(0, 10);

  return (
    classDate < local.date ||
    (classDate === local.date && cls.start_minutes <= local.minutes)
  );
};

const findClassInGym = async (gymId, classId) => {
  const cls = await gymClassRepository.findById(classId);
  if (!cls || cls.gym_id !== gymId) throw new Error("CLASS_NOT_FOUND");
  return cls;
};

const assertInstructorInGym = async (gymId, instructorId) => {
  if (!instructorId) throw new Error("INSTRUCTOR_NOT_FOUND");

  const membership =
    await gymMembershipRepository.findMembershipByUserId(instructorId);

  if (!membership) throw new Error("INSTRUCTOR_NOT_FOUND");
  if (membership.gym_id !== gymId) throw new Error("INSTRUCTOR_NOT_IN_GYM");
  if (!membership.gym_roles.includes("TRAINER")) {
    throw new Error("INSTRUCTOR_NOT_TRAINER");
  }
};

const validateClassFields = (fields) => {
  const {
    activity,
    name,
    room,
    color,
    class_date,
    start_minutes,
    duration_minutes,
    capacity,
  } = fields;

  if (!class_date) throw new Error("INVALID_DATE");

  for (const value of [activity, name, room, color]) {
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error("INVALID_INPUT");
    }
  }

  if (!Number.isInteger(duration_minutes) || duration_minutes <= 0) {
    throw new Error("INVALID_DURATION");
  }
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new Error("INVALID_CAPACITY");
  }
  if (
    !Number.isInteger(start_minutes) ||
    start_minutes < 0 ||
    start_minutes + duration_minutes > MINUTES_PER_DAY
  ) {
    throw new Error("INVALID_START");
  }
};

export const listClasses = async (gymId, { from, to } = {}) => {
  const fromDate = parseDate(from);
  const toDate = parseDate(to);

  if (!fromDate || !toDate || fromDate > toDate) {
    throw new Error("INVALID_RANGE");
  }
  if ((toDate - fromDate) / MS_PER_DAY > MAX_RANGE_DAYS) {
    throw new Error("RANGE_TOO_LARGE");
  }

  return await gymClassRepository.findByGymAndRange(gymId, fromDate, toDate);
};

export const listTodayClasses = async (gymId, { date, userId } = {}) => {
  let target;
  if (date === undefined) {
    const gym = await gymRepository.findTimezoneById(gymId);
    target = parseDate(localDateAndMinutes(gym?.timezone, new Date()).date);
  } else {
    target = parseDate(date);
  }

  if (!target) throw new Error("INVALID_DATE");

  const classes = await gymClassRepository.findByGymAndDate(gymId, target);
  const enrolledIds = new Set(
    await gymClassEnrollmentRepository.findEnrolledClassIds(
      userId,
      classes.map((cls) => cls.id),
    ),
  );

  return classes.map((cls) => ({ ...cls, is_enrolled: enrolledIds.has(cls.id) }));
};

export const createClass = async (gymId, payload) => {
  await assertInstructorInGym(gymId, payload.instructor_id);

  const data = {
    gym_id: gymId,
    instructor_id: payload.instructor_id,
    activity: payload.activity,
    name: payload.name,
    class_date: parseDate(payload.date),
    start_minutes: payload.start_minutes,
    duration_minutes: payload.duration_minutes,
    room: payload.room,
    capacity: payload.capacity,
    enrolled: 0,
    color: payload.color,
  };

  validateClassFields(data);

  return await gymClassRepository.create(data);
};

export const updateClass = async (gymId, classId, payload) => {
  const existing = await gymClassRepository.findById(classId);
  if (!existing || existing.gym_id !== gymId) throw new Error("CLASS_NOT_FOUND");

  if (payload.instructor_id !== undefined) {
    await assertInstructorInGym(gymId, payload.instructor_id);
  }

  const data = {};
  if (payload.instructor_id !== undefined) {
    data.instructor_id = payload.instructor_id;
  }
  if (payload.date !== undefined) {
    data.class_date = parseDate(payload.date);
  }
  for (const field of UPDATABLE_FIELDS) {
    if (payload[field] !== undefined) data[field] = payload[field];
  }

  validateClassFields({ ...existing, ...data });

  if (data.capacity !== undefined && data.capacity < existing.enrolled) {
    throw new Error("CAPACITY_BELOW_ENROLLED");
  }

  return await gymClassRepository.update(classId, data);
};

export const deleteClass = async (gymId, classId) => {
  const existing = await gymClassRepository.findById(classId);
  if (!existing || existing.gym_id !== gymId) throw new Error("CLASS_NOT_FOUND");

  await gymClassRepository.remove(classId);
};

export const enrollInClass = async (gymId, classId, { userId, membershipStatus }) => {
  const cls = await findClassInGym(gymId, classId);

  if (membershipStatus !== "ACTIVE") throw new Error("MEMBERSHIP_INACTIVE");
  if (hasClassStarted(cls)) throw new Error("CLASS_ALREADY_STARTED");

  await gymClassEnrollmentRepository.enrollUser(classId, userId);

  return await gymClassRepository.findById(classId);
};

export const cancelEnrollment = async (gymId, classId, userId) => {
  const cls = await findClassInGym(gymId, classId);

  if (hasClassStarted(cls)) throw new Error("CLASS_ALREADY_STARTED");

  await gymClassEnrollmentRepository.cancelEnrollment(classId, userId);

  return await gymClassRepository.findById(classId);
};

export const listEnrollments = async (gymId, classId) => {
  await findClassInGym(gymId, classId);

  return await gymClassEnrollmentRepository.listEnrollments(classId);
};
