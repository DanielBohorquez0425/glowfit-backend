import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

const state = { rows: [] };
const calls = [];

mock.module("../../src/repositories/exerciseRepository.js", {
  namedExports: {
    findAll: async () => ({ exercises: [], total: 0 }),
    findPage: async (...args) => {
      calls.push(args);
      return state.rows;
    },
    findById: async () => null,
    create: async () => ({}),
    update: async () => ({}),
    remove: async () => ({}),
  },
});

const { getExercisesPage } = await import("../../src/services/exerciseService.js");
const { getExercises } = await import("../../src/controllers/exercisesController.js");

const CURSOR = "3f2b8c1e-9a4d-4e2f-8b1a-2c3d4e5f6a7b";
const rows = (n) => Array.from({ length: n }, (_, i) => ({ id: `id-${i + 1}` }));

const fakeRes = () => {
  const res = { statusCode: 200, body: undefined };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
};

const run = async (query) => {
  const res = fakeRes();
  await getExercises({ query }, res);
  return res;
};

beforeEach(() => {
  calls.length = 0;
  state.rows = [];
  mock.method(console, "error", () => {});
});

test("service: extra row means hasMore with nextCursor = last returned id", async () => {
  state.rows = rows(4);
  const result = await getExercisesPage({ limit: 3 });
  assert.deepEqual(result, {
    data: rows(3),
    pagination: { nextCursor: "id-3", hasMore: true },
  });
});

test("service: exactly limit rows means no more pages", async () => {
  state.rows = rows(3);
  const result = await getExercisesPage({ limit: 3 });
  assert.deepEqual(result.pagination, { nextCursor: null, hasMore: false });
  assert.equal(result.data.length, 3);
});

test("service: empty result", async () => {
  const result = await getExercisesPage({ limit: 3 });
  assert.deepEqual(result, {
    data: [],
    pagination: { nextCursor: null, hasMore: false },
  });
});

test("controller: defaults to limit 20 and no cursor", async () => {
  const res = await run({});
  assert.equal(res.statusCode, 200);
  assert.equal(calls[0][0].limit, 20);
  assert.equal(calls[0][0].cursor, undefined);
  assert.deepEqual(res.body, {
    data: [],
    pagination: { nextCursor: null, hasMore: false },
  });
});

test("controller: forwards cursor and filters", async () => {
  await run({ limit: "5", cursor: CURSOR, difficulty: "beginner", includeRelations: "true" });
  assert.deepEqual(calls[0][0], {
    limit: 5,
    cursor: CURSOR,
    search: undefined,
    muscleGroupId: undefined,
    includeRelations: true,
    link: undefined,
    difficulty: "beginner",
  });
});

test("controller: forwards trimmed search", async () => {
  await run({ search: "  press  " });
  assert.equal(calls[0][0].search, "press");
});

for (const search of ["", "   "]) {
  test(`controller: ignores blank search ${JSON.stringify(search)}`, async () => {
    await run({ search });
    assert.equal(calls[0][0].search, undefined);
  });
}

for (const [label, search] of [
  ["too long search", "a".repeat(101)],
  ["array search", ["a", "b"]],
]) {
  test(`controller: 400 for ${label}`, async () => {
    const res = await run({ search });
    assert.equal(res.statusCode, 400);
    assert.equal(calls.length, 0);
  });
}

test("controller: caps limit at 100", async () => {
  await run({ limit: "5000" });
  assert.equal(calls[0][0].limit, 100);
});

for (const limit of ["0", "-1", "abc", "2.5"]) {
  test(`controller: 400 for limit=${limit}`, async () => {
    const res = await run({ limit });
    assert.equal(res.statusCode, 400);
    assert.equal(calls.length, 0);
  });
}

test("controller: 400 for malformed cursor", async () => {
  const res = await run({ cursor: "not-a-uuid" });
  assert.equal(res.statusCode, 400);
  assert.equal(calls.length, 0);
});
