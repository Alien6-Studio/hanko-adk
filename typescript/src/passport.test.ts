import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPairSync, sign } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Strategy, type StrategyOptionsWithoutRequest } from "passport-jwt";

import { createHankoJwtStrategyOptions, createHankoJwksSecretProvider } from "./passport.js";

test("creates fail-closed Passport options for a Hanko resource server", () => {
  const options = createHankoJwtStrategyOptions({
    issuer: "https://auth.example.test/realms/demo/",
    audience: " signal-api ",
  });

  assert.equal(options.issuer, "https://auth.example.test/realms/demo");
  assert.equal(options.audience, "signal-api");
  assert.deepEqual(options.algorithms, ["RS256"]);
  assert.equal("secretOrKeyProvider" in options, true);
  assert.equal(typeof options.jwtFromRequest, "function");
});

test("enforces the shared access-token contract through real Passport verification", async (t) => {
  const contract = JSON.parse(await readFile(
    new URL("../../go/testdata/access-token-contract.json", import.meta.url), "utf8",
  )) as {
    now: number;
    base: Record<string, unknown>;
    cases: { name: string; valid?: boolean; claims?: Record<string, unknown>; remove?: string[] }[];
  };
  let currentTime = contract.now * 1000;
  t.mock.method(Date, "now", () => currentTime);
  const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const publicJwk = { ...keys.publicKey.export({ format: "jwk" }), kid: "test-key", use: "sig", alg: "RS256" };
  let issuer = "";
  let expireDuringKeyFetch = false;
  const server = createServer((request, response) => {
    if (request.url === "/jwks" && expireDuringKeyFetch) currentTime += 2000;
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(request.url === "/jwks"
      ? { keys: [publicJwk] }
      : { issuer, jwks_uri: `${issuer}/jwks` }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  issuer = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const options = createHankoJwtStrategyOptions({ issuer, audience: "trunx-api" });
  const encode = (claims: Record<string, unknown>, algorithm = "RS256", privateKey = keys.privateKey): string => {
    const header = Buffer.from(JSON.stringify({ alg: algorithm, kid: "test-key", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
    const input = `${header}.${payload}`;
    return `${input}.${sign("RSA-SHA256", Buffer.from(input), privateKey).toString("base64url")}`;
  };
  const authenticate = (token: string, strategyOptions = options): Promise<{ accepted: boolean; callbackCalls: number }> => new Promise((resolve, reject) => {
    let callbackCalls = 0;
    const strategy = new Strategy(strategyOptions as StrategyOptionsWithoutRequest, (_claims, done) => {
      callbackCalls += 1;
      done(null, { id: "user-123" });
    });
    strategy.success = () => resolve({ accepted: true, callbackCalls });
    strategy.fail = () => resolve({ accepted: false, callbackCalls });
    strategy.error = reject;
    strategy.authenticate({ headers: { authorization: `Bearer ${token}` } } as Parameters<Strategy["authenticate"]>[0]);
  });
  for (const vector of contract.cases) {
    await t.test(vector.name, async () => {
      const claims: Record<string, unknown> = { iss: issuer, ...contract.base, ...vector.claims };
      for (const field of vector.remove ?? []) delete claims[field];
      const result = await authenticate(encode(claims));
      assert.equal(result.accepted, vector.valid ?? false);
      assert.equal(result.callbackCalls, vector.valid ? 1 : 0);
    });
  }
  // Expiration remains strict even when the token expires during JWKS I/O.
  expireDuringKeyFetch = true;
  const expiring = encode({ iss: issuer, ...contract.base, exp: contract.now + 1 });
  assert.deepEqual(await authenticate(expiring, createHankoJwtStrategyOptions({ issuer, audience: "trunx-api" })),
    { accepted: false, callbackCalls: 0 });
  expireDuringKeyFetch = false;
  currentTime = contract.now * 1000;
  const claims = { iss: issuer, ...contract.base };
  const otherKey = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
  for (const token of [encode(claims, "RS256", otherKey), encode(claims, "HS256"), "malformed.jwt"]) {
    assert.deepEqual(await authenticate(token), { accepted: false, callbackCalls: 0 });
  }
});

test("rejects malformed payloads before discovery and recovers after discovery failure", async () => {
  let calls = 0;
  const provider = createHankoJwksSecretProvider("https://auth.example.test", {
    fetch: async () => { calls += 1; return new Response("{}", { status: 503 }); },
  });
  const result = (token: unknown): Promise<unknown> => new Promise((resolve) => provider({}, token, (error) => resolve(error)));
  for (const token of [null, "malformed.jwt", "a.b.c", "a.%%%.c", "a.bnVsbA.c", "a.W10.c", "a." + "x".repeat(65536) + ".c"]) {
    assert.ok(await result(token) instanceof Error);
  }
  assert.equal(calls, 0);
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ sub: "fixture", hanko_token_use: "access", iat: now, exp: now + 60 })).toString("base64url");
  for (let i = 0; i < 2; i += 1) assert.ok(await result(`a.${payload}.c`) instanceof Error);
  assert.equal(calls, 2);
});
