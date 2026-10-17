import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

const { estimateMealMacrosFromPhotoWithAI } = await import("../../src/services/aiService.js");

const originalFetch = globalThis.fetch;
const requests = [];
let replyContent;

const okResponse = (content) => ({
  ok: true,
  status: 200,
  json: async () => ({ choices: [{ message: { content } }] }),
});

beforeEach(() => {
  requests.length = 0;
  replyContent = JSON.stringify({
    is_food: true,
    title: "Rice with chicken",
    calories: 519.6,
    protein_g: 35,
    fat_g: 12.5,
    carbs_g: 60,
  });
  globalThis.fetch = async (url, options) => {
    requests.push(JSON.parse(options.body));
    return okResponse(replyContent);
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const input = { imageBuffer: Buffer.from("abc"), mimeType: "image/png" };

test("sends the photo as a base64 data URL image part", async () => {
  await estimateMealMacrosFromPhotoWithAI(input);

  const content = requests[0].messages[0].content;
  const imagePart = content.find((part) => part.type === "image_url");
  assert.equal(imagePart.image_url.url, `data:image/png;base64,${Buffer.from("abc").toString("base64")}`);
  assert.ok(content.some((part) => part.type === "text"));
});

test("includes the optional description in the prompt", async () => {
  await estimateMealMacrosFromPhotoWithAI({ ...input, description: "no oil" });

  const textPart = requests[0].messages[0].content.find((part) => part.type === "text");
  assert.match(textPart.text, /no oil/);
});

test("returns a title and rounded calories with the macros", async () => {
  const result = await estimateMealMacrosFromPhotoWithAI(input);
  assert.deepEqual(result, {
    title: "Rice with chicken",
    calories: 520,
    protein_g: 35,
    fat_g: 12.5,
    carbs_g: 60,
  });
});

test("throws NO_FOOD_DETECTED when the model says the photo has no food", async () => {
  replyContent = JSON.stringify({ is_food: false });
  await assert.rejects(estimateMealMacrosFromPhotoWithAI(input), { message: "NO_FOOD_DETECTED" });
});

test("rejects invalid macros", async () => {
  replyContent = JSON.stringify({ is_food: true, title: "X", calories: -1, protein_g: 1, fat_g: 1, carbs_g: 1 });
  await assert.rejects(estimateMealMacrosFromPhotoWithAI(input));
});
