import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

const state = { googleLogin: async () => ({}) };
const calls = [];

mock.module("../../src/services/userService.js", {
  namedExports: {
    googleLogin: async (...args) => {
      calls.push(args);
      return state.googleLogin(...args);
    },
  },
});

const { googleLogin } = await import("../../src/controllers/userController.js");

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

const run = async (body) => {
  const res = fakeRes();
  await googleLogin({ body }, res);
  return res;
};

beforeEach(() => {
  calls.length = 0;
  state.googleLogin = async () => ({ user: {}, accessToken: "t" });
  mock.method(console, "error", () => {});
});

for (const [label, body] of [
  ["missing idToken", {}],
  ["empty idToken", { idToken: "" }],
  ["non-string idToken", { idToken: 123 }],
  ["object idToken", { idToken: { a: 1 } }],
]) {
  test(`400 for ${label}`, async () => {
    const res = await run(body);
    assert.equal(res.statusCode, 400);
    assert.equal(calls.length, 0);
  });
}

test("200 returns the service result", async () => {
  const res = await run({ idToken: "tok" });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { user: {}, accessToken: "t" });
  assert.deepEqual(calls, [["tok"]]);
});

for (const code of ["INVALID_GOOGLE_TOKEN", "GOOGLE_EMAIL_NOT_VERIFIED", "Credenciales inválidas"]) {
  test(`401 for ${code}`, async () => {
    state.googleLogin = async () => {
      throw new Error(code);
    };
    const res = await run({ idToken: "tok" });
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, code);
  });
}

test("409 for GOOGLE_ACCOUNT_CONFLICT", async () => {
  state.googleLogin = async () => {
    throw new Error("GOOGLE_ACCOUNT_CONFLICT");
  };
  const res = await run({ idToken: "tok" });
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error, "Existen varias cuentas con este email. Contacte a soporte.");
});

for (const code of ["GOOGLE_CLIENT_IDS_NOT_CONFIGURED", "boom"]) {
  test(`500 for ${code}`, async () => {
    state.googleLogin = async () => {
      throw new Error(code);
    };
    const res = await run({ idToken: "tok" });
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.error, "Error interno del servidor");
  });
}
