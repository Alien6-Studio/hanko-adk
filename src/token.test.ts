import assert from "node:assert/strict";
import test from "node:test";
import { HankoTokenClient } from "./token.js";

const issuer = "https://auth.example.test/realms/shared";
const config = { issuer, clientId: "example-agent", clientSecret: "synthetic-secret" };
const type = "urn:ietf:params:oauth:token-type:access_token";
const response = { access_token: "opaque-example-access-token", token_type: "bearer", expires_in: 300, scope: "read", issued_token_type: type };

test("backend and agent requests use exact discovery and freshly resolved secrets", async () => {
  const requests: URLSearchParams[] = [];
  let secrets = 0;
  const client = new HankoTokenClient(config, {
    clientSecret: () => `rotated-${++secrets}`,
    fetch: async (input, init) => {
      if (String(input).endsWith("/openid-configuration")) return Response.json({ issuer, token_endpoint: `${issuer}/token` });
      assert.equal(String(input), `${issuer}/token`);
      assert.equal(init?.method, "POST");
      assert.equal(init?.redirect, "error");
      assert.equal(new Headers(init?.headers).get("Content-Type"), "application/x-www-form-urlencoded");
      requests.push(new URLSearchParams(String(init?.body)));
      return Response.json({ ...response, refresh_token: "must-not-escape", id_token: "must-not-escape" });
    },
  });
  assert.deepEqual(await client.clientCredentials(["read", "read"]), { access_token: response.access_token, token_type: "Bearer", expires_in: 300, scope: "read" });
  const exchanged = await client.exchangeToken({ subjectToken: "subject-token", actorToken: "actor-token", audience: "example-api", scopes: ["read"] });
  assert.equal(exchanged.issued_token_type, type);
  assert.equal("refresh_token" in exchanged, false);
  assert.deepEqual(Object.fromEntries(requests[0]!), { grant_type: "client_credentials", scope: "read", client_id: config.clientId, client_secret: "rotated-1" });
  assert.deepEqual(Object.fromEntries(requests[1]!), {
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange", subject_token: "subject-token", subject_token_type: type,
    requested_token_type: type, audience: "example-api", scope: "read", actor_token: "actor-token", actor_token_type: type,
    client_id: config.clientId, client_secret: "rotated-2",
  });
});

test("backend rejects invalid token responses and exchange token classes", async () => {
  for (const invalid of [null, {}, { ...response, access_token: "" }, { ...response, token_type: "DPoP" }, { ...response, expires_in: 3601 }, { ...response, expires_in: 0 }, { ...response, expires_in: 1.5 }, { ...response, scope: [] }, { ...response, scope: null }]) {
    const client = new HankoTokenClient(config, { fetch: async (input) => Response.json(String(input).endsWith("/openid-configuration") ? { issuer, token_endpoint: `${issuer}/token` } : invalid) });
    await assert.rejects(client.clientCredentials(), /Invalid Hanko access-token response/);
  }
  const client = new HankoTokenClient(config, { fetch: async (input) => Response.json(String(input).endsWith("/openid-configuration") ? { issuer, token_endpoint: `${issuer}/token` } : { ...response, issued_token_type: "id_token" }) });
  await assert.rejects(client.exchangeToken({ subjectToken: "subject", audience: "api", scopes: ["read"] }), /Invalid Hanko access-token response/);
});

test("backend fails closed on unsafe discovery, redirects, denials and credential rotation failures", async () => {
  for (const metadata of [{ issuer: `${issuer}-other`, token_endpoint: `${issuer}/token` }, { issuer, token_endpoint: "https://evil.example.test/token" }]) {
    let calls = 0;
    const client = new HankoTokenClient(config, { fetch: async () => { calls++; return Response.json(metadata); } });
    await assert.rejects(client.clientCredentials());
    assert.equal(calls, 1);
  }
  for (const status of [302, 400, 401, 403, 503]) {
    const client = new HankoTokenClient(config, { fetch: async (input) => String(input).endsWith("/openid-configuration") ? Response.json({ issuer, token_endpoint: `${issuer}/token` }) : new Response("private provider error", { status }) });
    await assert.rejects(client.clientCredentials(), new RegExp(`status ${status}$`));
  }
  const client = new HankoTokenClient(config, { clientSecret: () => " ", fetch: async () => { throw new Error("must not send"); } });
  await assert.rejects(client.clientCredentials(), /require a client secret/);
});

test("exchange requires explicit audience, subject and valid scopes before any call", async () => {
  const client = new HankoTokenClient(config, { fetch: async () => { throw new Error("must not send"); } });
  for (const patch of [{ subjectToken: "" }, { audience: "" }, { scopes: [] }, { actorToken: " " }]) {
    assert.throws(() => client.exchangeToken({ subjectToken: "subject", audience: "api", scopes: ["read"], ...patch }), /requires/);
  }
  for (const scope of ["", "read write", "read\nwrite", 'read"write', "read\\write", "é"]) {
    assert.throws(() => client.exchangeToken({ subjectToken: "subject", audience: "api", scopes: [scope] }), /scope/);
    await assert.rejects(async () => client.clientCredentials([scope]), /scope/);
  }
  const delegated = new HankoTokenClient(config, { fetch: async (input) => Response.json(String(input).endsWith("/openid-configuration") ? { issuer, token_endpoint: `${issuer}/token` } : response) });
  assert.equal((await delegated.exchangeToken({ subjectToken: "subject", audience: "api", scopes: ["read"] })).token_type, "Bearer");
});
