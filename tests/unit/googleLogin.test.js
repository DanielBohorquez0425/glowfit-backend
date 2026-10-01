import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";

// Mutable state shared with the module mocks below.
const state = {
  verify: async () => ({ getPayload: () => ({}) }),
  repo: {},
};
const calls = { increment: [], link: [], create: [], verifyArgs: [] };

const repoFn = (name) => async (...args) => state.repo[name](...args);

mock.module("google-auth-library", {
  namedExports: {
    OAuth2Client: class {
      async verifyIdToken(args) {
        calls.verifyArgs.push(args);
        return state.verify(args);
      }
    },
  },
});
mock.module("../../src/repositories/userRepository.js", {
  namedExports: {
    findByEmailWithMembership: repoFn("findByEmailWithMembership"),
    findByEmailIncludingDeleted: repoFn("findByEmailIncludingDeleted"),
    findManyByEmailInsensitiveIncludingDeleted: repoFn("findManyByEmailInsensitiveIncludingDeleted"),
    findByGoogleIdIncludingDeleted: repoFn("findByGoogleIdIncludingDeleted"),
    findByGoogleIdWithMembership: repoFn("findByGoogleIdWithMembership"),
    linkGoogleId: repoFn("linkGoogleId"),
    create: repoFn("create"),
    incrementTokenVersion: repoFn("incrementTokenVersion"),
  },
});
mock.module("../../src/repositories/gymMembershipRepository.js", { namedExports: {} });
mock.module("../../src/services/dailyfitService.js", { namedExports: {} });
mock.module("../../src/services/streakService.js", { namedExports: {} });
mock.module("../../src/services/emailService.js", {
  namedExports: { sendPasswordResetCode: async () => {}, sendPasswordSetupEmail: async () => {} },
});
mock.module("../../src/utils/jwtUtils.js", {
  namedExports: { generateAccessToken: (id, email, tv) => `token:${id}:${email}:${tv}` },
});

const { googleLogin, login } = await import("../../src/services/userService.js");

const googleUser = { id: "u1", email: "ana@example.com", name: "Ana", gym_membership: null };

const goodPayload = {
  sub: "g-123",
  email: "ana@example.com",
  email_verified: true,
  given_name: "Ana",
  family_name: "Lopez",
};

beforeEach(() => {
  process.env.GOOGLE_CLIENT_IDS = " android-id , ios-id,web-id ";
  calls.increment = [];
  calls.link = [];
  calls.create = [];
  calls.verifyArgs = [];
  state.verify = async () => ({ getPayload: () => goodPayload });
  state.repo = {
    findByGoogleIdWithMembership: async () => null,
    findByEmailIncludingDeleted: async () => null,
    // Derived from the active lookup so tests only need to set one of them.
    findByGoogleIdIncludingDeleted: async (...args) => {
      const u = await state.repo.findByGoogleIdWithMembership(...args);
      return u ? { id: u.id, deleted_at: null } : null;
    },
    findManyByEmailInsensitiveIncludingDeleted: async () => [],
    findByEmailWithMembership: async () => null,
    linkGoogleId: async (id, gid) => calls.link.push([id, gid]),
    create: async (data) => {
      calls.create.push(data);
      return { id: "u1" };
    },
    incrementTokenVersion: async (id) => {
      calls.increment.push(id);
      return 5;
    },
  };
});

test("throws when GOOGLE_CLIENT_IDS is missing", async () => {
  delete process.env.GOOGLE_CLIENT_IDS;
  await assert.rejects(() => googleLogin("tok"), { message: "GOOGLE_CLIENT_IDS_NOT_CONFIGURED" });
});

test("passes trimmed audience list to verifyIdToken", async () => {
  state.repo.findByGoogleIdWithMembership = async () => googleUser;
  await googleLogin("tok");
  assert.deepEqual(calls.verifyArgs[0], {
    idToken: "tok",
    audience: ["android-id", "ios-id", "web-id"],
  });
});

test("invalid or expired token -> INVALID_GOOGLE_TOKEN", async () => {
  state.verify = async () => {
    throw new Error("Token used too late");
  };
  await assert.rejects(() => googleLogin("bad"), { message: "INVALID_GOOGLE_TOKEN" });
});

test("missing payload -> INVALID_GOOGLE_TOKEN", async () => {
  state.verify = async () => ({ getPayload: () => undefined });
  await assert.rejects(() => googleLogin("bad"), { message: "INVALID_GOOGLE_TOKEN" });
});

test("unverified email -> GOOGLE_EMAIL_NOT_VERIFIED", async () => {
  state.verify = async () => ({ getPayload: () => ({ ...goodPayload, email_verified: false }) });
  await assert.rejects(() => googleLogin("tok"), { message: "GOOGLE_EMAIL_NOT_VERIFIED" });
});

test("existing google user logs in, bumps token_version, no password in response", async () => {
  state.repo.findByGoogleIdWithMembership = async () => ({ ...googleUser, password: null });
  const result = await googleLogin("tok");
  assert.deepEqual(calls.increment, ["u1"]);
  assert.equal(result.accessToken, "token:u1:ana@example.com:5");
  assert.equal(result.user.gym_membership, null);
  assert.equal("password" in result.user, false);
  assert.equal(calls.create.length, 0);
  assert.equal(calls.link.length, 0);
});

test("links google_id and clears password on existing email account", async () => {
  let reloaded = false;
  state.repo.findManyByEmailInsensitiveIncludingDeleted = async () => [{ id: "u1", deleted_at: null }];
  state.repo.findByGoogleIdWithMembership = async () => (reloaded ? googleUser : null);
  state.repo.linkGoogleId = async (id, gid) => {
    calls.link.push([id, gid]);
    reloaded = true;
  };
  const result = await googleLogin("tok");
  assert.deepEqual(calls.link, [["u1", { google_id: "g-123", password: null }]]);
  assert.equal(calls.create.length, 0);
  assert.equal(result.accessToken, "token:u1:ana@example.com:5");
});

test("creates a new user with null password", async () => {
  let reloaded = false;
  state.repo.findByGoogleIdWithMembership = async () => (reloaded ? googleUser : null);
  state.repo.create = async (data) => {
    calls.create.push(data);
    reloaded = true;
    return { id: "u1" };
  };
  await googleLogin("tok");
  assert.deepEqual(calls.create, [
    {
      email: "ana@example.com",
      google_id: "g-123",
      name: "Ana",
      last_name: "Lopez",
      password: null,
    },
  ]);
});

test("mixed-case google email: case-insensitive lookup and lowercase on create", async () => {
  const lookups = [];
  let reloaded = false;
  state.verify = async () => ({ getPayload: () => ({ ...goodPayload, email: "Ana@Example.COM" }) });
  state.repo.findByGoogleIdWithMembership = async () => (reloaded ? googleUser : null);
  state.repo.findManyByEmailInsensitiveIncludingDeleted = async (email) => {
    lookups.push(email);
    return [];
  };
  state.repo.create = async (data) => {
    calls.create.push(data);
    reloaded = true;
    return { id: "u1" };
  };
  await googleLogin("tok");
  assert.deepEqual(lookups, ["ana@example.com"]);
  assert.equal(calls.create[0].email, "ana@example.com");
});

test("soft-deleted account matched by email is rejected like login", async () => {
  state.repo.findManyByEmailInsensitiveIncludingDeleted = async () => [{ id: "u1", deleted_at: new Date() }];
  await assert.rejects(() => googleLogin("tok"), { message: "Credenciales inválidas" });
  assert.equal(calls.link.length, 0);
  assert.equal(calls.create.length, 0);
});

test("login with password on a Google-only account -> Credenciales inválidas", async () => {
  state.repo.findByEmailWithMembership = async () => ({ ...googleUser, password: null });
  await assert.rejects(() => login("ana@example.com", "whatever"), {
    message: "Credenciales inválidas",
  });
  assert.equal(calls.increment.length, 0);
});

const dbUser = (password) => ({ ...googleUser, password, token_version: 1 });

test("login happy path: user without password, token from incremented version", async () => {
  const hash = await bcrypt.hash("secret123", 4);
  state.repo.findByEmailWithMembership = async () => dbUser(hash);
  const result = await login("ana@example.com", "secret123");
  assert.deepEqual(calls.increment, ["u1"]);
  assert.equal(result.accessToken, "token:u1:ana@example.com:5");
  assert.equal("password" in result.user, false);
  assert.equal(result.user.email, "ana@example.com");
  assert.equal(result.user.gym_membership, null);
});

test("login with wrong password -> Credenciales inválidas", async () => {
  const hash = await bcrypt.hash("secret123", 4);
  state.repo.findByEmailWithMembership = async () => dbUser(hash);
  await assert.rejects(() => login("ana@example.com", "nope"), { message: "Credenciales inválidas" });
  assert.equal(calls.increment.length, 0);
});

test("login with unknown user still runs bcrypt.compare against a dummy hash", async () => {
  const spy = mock.method(bcrypt, "compare");
  try {
    await assert.rejects(() => login("x@example.com", "pw"), { message: "Credenciales inválidas" });
    assert.equal(spy.mock.callCount(), 1);
    assert.equal(spy.mock.calls[0].arguments[0], "pw");
    assert.match(spy.mock.calls[0].arguments[1], /^\$2[aby]\$10\$/);
  } finally {
    spy.mock.restore();
  }
});

test("login with null password still runs bcrypt.compare against a dummy hash", async () => {
  state.repo.findByEmailWithMembership = async () => dbUser(null);
  const spy = mock.method(bcrypt, "compare");
  try {
    await assert.rejects(() => login("ana@example.com", "pw"), { message: "Credenciales inválidas" });
    assert.equal(spy.mock.callCount(), 1);
    assert.match(spy.mock.calls[0].arguments[1], /^\$2[aby]\$10\$/);
  } finally {
    spy.mock.restore();
  }
});

test("missing or non-string email/sub claim -> INVALID_GOOGLE_TOKEN", async () => {
  for (const bad of [{ email: undefined }, { email: 42 }, { sub: undefined }, { sub: 7 }]) {
    state.verify = async () => ({ getPayload: () => ({ ...goodPayload, ...bad }) });
    await assert.rejects(() => googleLogin("tok"), { message: "INVALID_GOOGLE_TOKEN" });
  }
  assert.equal(calls.create.length, 0);
});

test("soft-deleted google_id match is rejected like login", async () => {
  state.repo.findByGoogleIdIncludingDeleted = async () => ({ id: "u1", deleted_at: new Date() });
  await assert.rejects(() => googleLogin("tok"), { message: "Credenciales inválidas" });
  assert.equal(calls.increment.length, 0);
  assert.equal(calls.create.length, 0);
  assert.equal(calls.link.length, 0);
});

test("P2002 on create (concurrent first login) re-runs the google_id lookup once", async () => {
  let raced = false;
  state.repo.findByGoogleIdWithMembership = async () => (raced ? googleUser : null);
  state.repo.create = async () => {
    raced = true;
    throw Object.assign(new Error("Unique constraint"), { code: "P2002" });
  };
  const result = await googleLogin("tok");
  assert.equal(result.accessToken, "token:u1:ana@example.com:5");
});

test("P2002 on link re-runs the google_id lookup once", async () => {
  let raced = false;
  state.repo.findManyByEmailInsensitiveIncludingDeleted = async () => [{ id: "u1", deleted_at: null }];
  state.repo.findByGoogleIdWithMembership = async () => (raced ? googleUser : null);
  state.repo.linkGoogleId = async () => {
    raced = true;
    throw Object.assign(new Error("Unique constraint"), { code: "P2002" });
  };
  const result = await googleLogin("tok");
  assert.equal(result.accessToken, "token:u1:ana@example.com:5");
});

test("non-P2002 errors from create are rethrown", async () => {
  state.repo.create = async () => {
    throw new Error("db down");
  };
  await assert.rejects(() => googleLogin("tok"), { message: "db down" });
});

test("P2002 with no user found on retry -> Credenciales inválidas", async () => {
  state.repo.create = async () => {
    throw Object.assign(new Error("Unique constraint"), { code: "P2002" });
  };
  await assert.rejects(() => googleLogin("tok"), { message: "Credenciales inválidas" });
});

test("re-fetch returns null after create -> Credenciales inválidas", async () => {
  await assert.rejects(() => googleLogin("tok"), { message: "Credenciales inválidas" });
  assert.equal(calls.increment.length, 0);
});

test("re-fetch returns null after link -> Credenciales inválidas", async () => {
  state.repo.findManyByEmailInsensitiveIncludingDeleted = async () => [{ id: "u1", deleted_at: null }];
  await assert.rejects(() => googleLogin("tok"), { message: "Credenciales inválidas" });
  assert.equal(calls.increment.length, 0);
});

test("multiple case-variant email matches -> GOOGLE_ACCOUNT_CONFLICT, nothing written", async () => {
  state.repo.findManyByEmailInsensitiveIncludingDeleted = async () => [
    { id: "u1", deleted_at: null },
    { id: "u2", deleted_at: null },
  ];
  await assert.rejects(() => googleLogin("tok"), { message: "GOOGLE_ACCOUNT_CONFLICT" });
  assert.equal(calls.link.length, 0);
  assert.equal(calls.create.length, 0);
});

test("absent given_name/family_name -> null name and last_name", async () => {
  let reloaded = false;
  state.verify = async () => ({
    getPayload: () => ({ sub: "g-123", email: "ana@example.com", email_verified: true }),
  });
  state.repo.findByGoogleIdWithMembership = async () => (reloaded ? googleUser : null);
  state.repo.create = async (data) => {
    calls.create.push(data);
    reloaded = true;
    return { id: "u1" };
  };
  await googleLogin("tok");
  assert.equal(calls.create[0].name, null);
  assert.equal(calls.create[0].last_name, null);
});
