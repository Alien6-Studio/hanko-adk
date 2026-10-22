import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createHankoAccessTokenVerifier } from "./verify.js";

test("standalone verifier enforces the portable token contract and actual signatures", async (t) => {
  const vectors = JSON.parse(
    await readFile(
      new URL("../testdata/access-token-contract.json", import.meta.url),
      "utf8",
    ),
  ) as {
    now: number;
    base: Record<string, unknown>;
    cases: {
      valid?: boolean;
      claims?: Record<string, unknown>;
      remove?: string[];
    }[];
  };
  t.mock.method(Date, "now", () => vectors.now * 1000);
  const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = {
    ...pair.publicKey.export({ format: "jwk" }),
    kid: "test",
    alg: "RS256",
    use: "sig",
  };
  const issuer = "https://auth.example.test/realms/example";
  const encode = (
    claims: Record<string, unknown>,
    algorithm = "RS256",
    key = pair.privateKey,
  ) => {
    const input = [
      JSON.stringify({ alg: algorithm, kid: "test" }),
      JSON.stringify(claims),
    ]
      .map((value) => Buffer.from(value).toString("base64url"))
      .join(".");
    return `${input}.${sign("RSA-SHA256", Buffer.from(input), key).toString("base64url")}`;
  };
  const verify = createHankoAccessTokenVerifier(
    { issuer, audience: "trunx-api" },
    {
      fetch: async (url) =>
        Response.json(
          String(url).endsWith("openid-configuration")
            ? { issuer, jwks_uri: `${issuer}/jwks` }
            : { keys: [jwk] },
        ),
    },
  );
  for (const vector of vectors.cases) {
    const claims: Record<string, unknown> = {
      iss: issuer,
      ...vectors.base,
      ...vector.claims,
    };
    for (const key of vector.remove ?? []) delete claims[key];
    if (vector.valid)
      assert.equal((await verify(encode(claims))).subject, "user-123");
    else await assert.rejects(verify(encode(claims)));
  }
  const claims = { iss: issuer, ...vectors.base };
  for (const token of [
    encode(claims, "HS256"),
    encode(
      claims,
      "RS256",
      generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey,
    ),
  ])
    await assert.rejects(verify(token));
  let attempts = 0;
  const recover = createHankoAccessTokenVerifier(
    { issuer, audience: "trunx-api" },
    {
      fetch: async (url) => {
        if (++attempts === 1) throw new Error("temporarily unavailable");
        return Response.json(
          String(url).endsWith("openid-configuration")
            ? { issuer, jwks_uri: `${issuer}/jwks` }
            : { keys: [jwk] },
        );
      },
    },
  );
  await assert.rejects(recover(encode(claims)));
  assert.equal((await recover(encode(claims))).issuer, issuer);
});
