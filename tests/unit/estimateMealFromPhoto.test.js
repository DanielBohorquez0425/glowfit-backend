import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Mutable state shared with the module mocks below.
const state = { ai: async () => ({}) };
const calls = { ai: [] };

mock.module("../../src/services/aiService.js", {
  namedExports: {
    estimateMealMacrosWithAI: async () => ({}),
    estimateMealMacrosFromPhotoWithAI: async (args) => {
      calls.ai.push(args);
      return state.ai(args);
    },
  },
});
mock.module("../../src/repositories/dailyfitRepository.js", { namedExports: {} });
mock.module("../../src/services/streakService.js", { namedExports: {} });
mock.module("../../src/config/prismaClient.js", { defaultExport: {} });

const { estimateMealMacrosFromPhoto } = await import("../../src/services/dailyfitService.js");

const photo = { buffer: Buffer.from("fake-image"), mimetype: "image/jpeg" };
const estimate = { title: "Rice with chicken", calories: 520, protein_g: 35, fat_g: 12, carbs_g: 60 };

beforeEach(() => {
  calls.ai = [];
  state.ai = async () => estimate;
});

test("returns the AI estimate for a valid photo", async () => {
  const result = await estimateMealMacrosFromPhoto(photo);
  assert.deepEqual(result, estimate);
  assert.equal(calls.ai.length, 1);
  assert.equal(calls.ai[0].mimeType, "image/jpeg");
  assert.equal(calls.ai[0].imageBuffer, photo.buffer);
  assert.equal(calls.ai[0].description, undefined);
});

test("passes a trimmed optional description as context", async () => {
  await estimateMealMacrosFromPhoto(photo, "  sauce on the side  ");
  assert.equal(calls.ai[0].description, "sauce on the side");
});

test("ignores a blank description", async () => {
  await estimateMealMacrosFromPhoto(photo, "   ");
  assert.equal(calls.ai[0].description, undefined);
});

test("throws INVALID_INPUT when no photo is sent", async () => {
  await assert.rejects(estimateMealMacrosFromPhoto(undefined), { message: "INVALID_INPUT" });
  assert.equal(calls.ai.length, 0);
});

test("throws INVALID_INPUT for an empty file", async () => {
  await assert.rejects(
    estimateMealMacrosFromPhoto({ buffer: Buffer.alloc(0), mimetype: "image/png" }),
    { message: "INVALID_INPUT" },
  );
});

test("throws INVALID_INPUT for a description that is not a string", async () => {
  await assert.rejects(estimateMealMacrosFromPhoto(photo, 42), { message: "INVALID_INPUT" });
});

test("throws INVALID_INPUT for a description longer than 300 characters", async () => {
  await assert.rejects(estimateMealMacrosFromPhoto(photo, "a".repeat(301)), { message: "INVALID_INPUT" });
  assert.equal(calls.ai.length, 0);
});

test("propagates NO_FOOD_DETECTED from the AI layer", async () => {
  state.ai = async () => {
    throw new Error("NO_FOOD_DETECTED");
  };
  await assert.rejects(estimateMealMacrosFromPhoto(photo), { message: "NO_FOOD_DETECTED" });
});

test("maps any other AI failure to AI_ESTIMATION_FAILED", async () => {
  state.ai = async () => {
    throw new Error("upstream timeout");
  };
  await assert.rejects(estimateMealMacrosFromPhoto(photo), { message: "AI_ESTIMATION_FAILED" });
});
