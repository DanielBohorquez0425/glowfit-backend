import { test, mock } from "node:test";
import assert from "node:assert/strict";

const calls = { findByUserId: [] };
const repoResult = { payments: [{ id: "p1" }], total: 1 };

mock.module("../../src/repositories/gymPaymentRepository.js", {
  namedExports: {
    findByUserId: async (...args) => {
      calls.findByUserId.push(args);
      return repoResult;
    },
  },
});
mock.module("../../src/repositories/gymPlanRepository.js", { namedExports: {} });
mock.module("../../src/repositories/gymMembershipRepository.js", { namedExports: {} });

const { listUserPayments } = await import("../../src/services/gymPaymentService.js");

test("listUserPayments delega al repositorio con userId, limit y offset", async () => {
  const result = await listUserPayments("u1", { limit: 10, offset: 20 });

  assert.deepEqual(calls.findByUserId, [["u1", { limit: 10, offset: 20 }]]);
  assert.equal(result, repoResult);
});
