import { test, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// Mutable state shared with the module mocks below.
const state = { classRepo: {}, enrollRepo: {}, gymRepo: {} };
const calls = { enroll: [], cancel: [], update: [] };

const classFn = (name) => async (...args) => state.classRepo[name](...args);
const enrollFn = (name) => async (...args) => state.enrollRepo[name](...args);

mock.module("../../src/repositories/gymClassRepository.js", {
  namedExports: {
    findById: classFn("findById"),
    findByGymAndDate: classFn("findByGymAndDate"),
    findByGymAndRange: classFn("findByGymAndRange"),
    create: classFn("create"),
    update: classFn("update"),
    remove: classFn("remove"),
  },
});
mock.module("../../src/repositories/gymClassEnrollmentRepository.js", {
  namedExports: {
    enrollUser: enrollFn("enrollUser"),
    cancelEnrollment: enrollFn("cancelEnrollment"),
    listEnrollments: enrollFn("listEnrollments"),
    findEnrolledClassIds: enrollFn("findEnrolledClassIds"),
  },
});
mock.module("../../src/repositories/gymRepository.js", {
  namedExports: {
    findTimezoneById: async (...args) => state.gymRepo.findTimezoneById(...args),
  },
});
mock.module("../../src/repositories/gymMembershipRepository.js", {
  namedExports: { findMembershipByUserId: async () => null },
});

const {
  enrollInClass,
  cancelEnrollment,
  listEnrollments,
  listTodayClasses,
  updateClass,
  hasClassStarted,
} = await import("../../src/services/gymClassService.js");

const GYM = "gym-1";
const futureClass = (overrides = {}) => ({
  id: "c1",
  gym_id: GYM,
  class_date: new Date(Date.UTC(2999, 0, 1)),
  start_minutes: 600,
  duration_minutes: 60,
  capacity: 10,
  enrolled: 3,
  ...overrides,
});
const pastClass = (overrides = {}) =>
  futureClass({ class_date: new Date(Date.UTC(2000, 0, 1)), ...overrides });

const rejectsWith = (promise, code) =>
  assert.rejects(promise, (err) => err.message === code);

beforeEach(() => {
  calls.enroll = [];
  calls.cancel = [];
  calls.update = [];
  state.classRepo = {
    findById: async () => futureClass(),
    findByGymAndDate: async () => [],
    update: async (id, data) => {
      calls.update.push({ id, data });
      return { id, ...data };
    },
  };
  state.gymRepo = { findTimezoneById: async () => ({ timezone: "America/Bogota" }) };
  state.enrollRepo = {
    enrollUser: async (classId, userId) => {
      calls.enroll.push({ classId, userId });
    },
    cancelEnrollment: async (classId, userId) => {
      calls.cancel.push({ classId, userId });
    },
    listEnrollments: async () => [],
    findEnrolledClassIds: async () => [],
  };
});

afterEach(() => mock.timers.reset());

const queriedDate = async (query, gym = undefined) => {
  let queried;
  if (gym !== undefined) state.gymRepo.findTimezoneById = async () => gym;
  state.classRepo.findByGymAndDate = async (gymId, date) => {
    queried = date.toISOString().slice(0, 10);
    return [];
  };
  await listTodayClasses(GYM, query);
  return queried;
};

test("today: no date at 21:00 Bogota (02:00 UTC next day) queries the Bogota date", async () => {
  mock.timers.enable({ apis: ["Date"], now: new Date("2026-03-11T02:00:00Z") });
  assert.equal(await queriedDate({ userId: "u1" }), "2026-03-10");
});

test("today: explicit date is passed through without a timezone lookup", async () => {
  mock.timers.enable({ apis: ["Date"], now: new Date("2026-03-11T02:00:00Z") });
  state.gymRepo.findTimezoneById = async () => {
    throw new Error("should not be called");
  };
  assert.equal(await queriedDate({ date: "2026-05-01", userId: "u1" }), "2026-05-01");
});

test("today: missing gym timezone falls back to Bogota", async () => {
  mock.timers.enable({ apis: ["Date"], now: new Date("2026-03-11T02:00:00Z") });
  assert.equal(await queriedDate({ userId: "u1" }, null), "2026-03-10");
});

test("today: honours a non-default gym timezone", async () => {
  mock.timers.enable({ apis: ["Date"], now: new Date("2026-03-11T02:00:00Z") });
  assert.equal(
    await queriedDate({ userId: "u1" }, { timezone: "Asia/Tokyo" }),
    "2026-03-11",
  );
});

const member = { userId: "u1", membershipStatus: "ACTIVE" };

test("enroll: enrolls an active member and returns the refreshed class", async () => {
  let reads = 0;
  state.classRepo.findById = async () => futureClass({ enrolled: reads++ === 0 ? 3 : 4 });

  const result = await enrollInClass(GYM, "c1", member);

  assert.deepEqual(calls.enroll, [{ classId: "c1", userId: "u1" }]);
  assert.equal(result.enrolled, 4);
});

test("enroll: class missing -> CLASS_NOT_FOUND", async () => {
  state.classRepo.findById = async () => null;
  await rejectsWith(enrollInClass(GYM, "c1", member), "CLASS_NOT_FOUND");
  assert.equal(calls.enroll.length, 0);
});

test("enroll: class from another gym -> CLASS_NOT_FOUND", async () => {
  state.classRepo.findById = async () => futureClass({ gym_id: "other" });
  await rejectsWith(enrollInClass(GYM, "c1", member), "CLASS_NOT_FOUND");
  assert.equal(calls.enroll.length, 0);
});

test("enroll: inactive membership -> MEMBERSHIP_INACTIVE", async () => {
  await rejectsWith(
    enrollInClass(GYM, "c1", { userId: "u1", membershipStatus: "EXPIRED" }),
    "MEMBERSHIP_INACTIVE",
  );
  assert.equal(calls.enroll.length, 0);
});

test("enroll: class already started -> CLASS_ALREADY_STARTED", async () => {
  state.classRepo.findById = async () => pastClass();
  await rejectsWith(enrollInClass(GYM, "c1", member), "CLASS_ALREADY_STARTED");
  assert.equal(calls.enroll.length, 0);
});

// Bogota is UTC-5 year-round (no DST).
const bogotaClass = (date, start_minutes, timezone = "America/Bogota") => ({
  class_date: new Date(`${date}T00:00:00.000Z`),
  start_minutes,
  gyms: { timezone },
});

test("hasClassStarted: 20:00 class at 15:30 Bogota (20:30 UTC) has NOT started", () => {
  const cls = bogotaClass("2026-03-10", 20 * 60);
  assert.equal(hasClassStarted(cls, new Date("2026-03-10T20:30:00Z")), false);
});

test("hasClassStarted: 20:00 class at exactly 20:00 Bogota has started", () => {
  const cls = bogotaClass("2026-03-10", 20 * 60);
  assert.equal(hasClassStarted(cls, new Date("2026-03-11T01:00:00Z")), true);
});

test("hasClassStarted: class from yesterday (local) has started", () => {
  const cls = bogotaClass("2026-03-09", 23 * 60);
  assert.equal(hasClassStarted(cls, new Date("2026-03-10T15:00:00Z")), true);
});

test("hasClassStarted: 23:30 Bogota (04:30 UTC next day), class today 23:45 NOT started", () => {
  const cls = bogotaClass("2026-03-10", 23 * 60 + 45);
  assert.equal(hasClassStarted(cls, new Date("2026-03-11T04:30:00Z")), false);
});

test("hasClassStarted: falls back to America/Bogota without a timezone", () => {
  const cls = { ...bogotaClass("2026-03-10", 20 * 60), gyms: undefined };
  assert.equal(hasClassStarted(cls, new Date("2026-03-10T20:30:00Z")), false);
  assert.equal(hasClassStarted(cls, new Date("2026-03-11T01:00:00Z")), true);
});

test("hasClassStarted: honours the gym timezone", () => {
  const cls = bogotaClass("2026-03-10", 20 * 60, "America/Mexico_City");
  // Mexico City is UTC-6 in March 2026: 20:30 UTC is 14:30 local.
  assert.equal(hasClassStarted(cls, new Date("2026-03-10T20:30:00Z")), false);
  assert.equal(hasClassStarted(cls, new Date("2026-03-11T02:00:00Z")), true);
});

test("enroll: propagates CLASS_FULL and ALREADY_ENROLLED from the repository", async () => {
  state.enrollRepo.enrollUser = async () => {
    throw new Error("CLASS_FULL");
  };
  await rejectsWith(enrollInClass(GYM, "c1", member), "CLASS_FULL");

  state.enrollRepo.enrollUser = async () => {
    throw new Error("ALREADY_ENROLLED");
  };
  await rejectsWith(enrollInClass(GYM, "c1", member), "ALREADY_ENROLLED");
});

test("cancel: cancels and returns the refreshed class", async () => {
  const result = await cancelEnrollment(GYM, "c1", "u1");
  assert.deepEqual(calls.cancel, [{ classId: "c1", userId: "u1" }]);
  assert.equal(result.id, "c1");
});

test("cancel: class not in gym -> CLASS_NOT_FOUND", async () => {
  state.classRepo.findById = async () => futureClass({ gym_id: "other" });
  await rejectsWith(cancelEnrollment(GYM, "c1", "u1"), "CLASS_NOT_FOUND");
  assert.equal(calls.cancel.length, 0);
});

test("cancel: class already started -> CLASS_ALREADY_STARTED", async () => {
  state.classRepo.findById = async () => pastClass();
  await rejectsWith(cancelEnrollment(GYM, "c1", "u1"), "CLASS_ALREADY_STARTED");
  assert.equal(calls.cancel.length, 0);
});

test("cancel: propagates NOT_ENROLLED", async () => {
  state.enrollRepo.cancelEnrollment = async () => {
    throw new Error("NOT_ENROLLED");
  };
  await rejectsWith(cancelEnrollment(GYM, "c1", "u1"), "NOT_ENROLLED");
});

test("list: returns enrollments for a class in the gym", async () => {
  const rows = [{ id: "e1" }];
  state.enrollRepo.listEnrollments = async (classId) => {
    assert.equal(classId, "c1");
    return rows;
  };
  assert.equal(await listEnrollments(GYM, "c1"), rows);
});

test("list: class not in gym -> CLASS_NOT_FOUND", async () => {
  state.classRepo.findById = async () => null;
  await rejectsWith(listEnrollments(GYM, "c1"), "CLASS_NOT_FOUND");
});

test("update: capacity below current enrolled -> CAPACITY_BELOW_ENROLLED", async () => {
  state.classRepo.findById = async () =>
    futureClass({
      activity: "Yoga",
      name: "Morning",
      room: "A",
      color: "#fff",
      enrolled: 5,
      capacity: 10,
    });
  await rejectsWith(
    updateClass(GYM, "c1", { capacity: 4 }),
    "CAPACITY_BELOW_ENROLLED",
  );
  assert.equal(calls.update.length, 0);
});

test("update: ignores admin-supplied enrolled", async () => {
  state.classRepo.findById = async () =>
    futureClass({
      activity: "Yoga",
      name: "Morning",
      room: "A",
      color: "#fff",
      enrolled: 5,
      capacity: 10,
    });
  await updateClass(GYM, "c1", { name: "Evening", enrolled: 0 });
  assert.equal("enrolled" in calls.update[0].data, false);
});

test("today: flags is_enrolled per class with a single lookup", async () => {
  let lookups = 0;
  state.classRepo.findByGymAndDate = async () => [
    futureClass({ id: "a" }),
    futureClass({ id: "b" }),
  ];
  state.enrollRepo.findEnrolledClassIds = async (userId, classIds) => {
    lookups++;
    assert.equal(userId, "u1");
    assert.deepEqual(classIds, ["a", "b"]);
    return ["b"];
  };

  const result = await listTodayClasses(GYM, { userId: "u1" });

  assert.equal(lookups, 1);
  assert.deepEqual(
    result.map((c) => [c.id, c.is_enrolled]),
    [["a", false], ["b", true]],
  );
});
