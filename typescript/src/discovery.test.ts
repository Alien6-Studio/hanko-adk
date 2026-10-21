import assert from "node:assert/strict";
import test from "node:test";

import { HankoDiscovery, type HankoFetch } from "./discovery.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("loads discovery once and validates required same-origin endpoints", async () => {
  let calls = 0;
  const fetcher: HankoFetch = async () => {
    calls += 1;
    return jsonResponse({
      issuer: "https://auth.example.test/realms/demo",
      token_endpoint: "https://auth.example.test/realms/demo/token",
      jwks_uri: "https://auth.example.test/realms/demo/certs",
    });
  };
  const discovery = new HankoDiscovery("https://auth.example.test/realms/demo", { fetch: fetcher });

  const first = await discovery.metadata(["token_endpoint"]);
  const second = await discovery.metadata(["jwks_uri"]);

  assert.equal(discovery.endpoint(first, "token_endpoint"), "https://auth.example.test/realms/demo/token");
  assert.equal(discovery.endpoint(second, "jwks_uri"), "https://auth.example.test/realms/demo/certs");
  assert.equal(calls, 1);
});

test("rejects a discovery endpoint on another origin", async () => {
  const discovery = new HankoDiscovery("https://auth.example.test/realms/demo", {
    fetch: async () =>
      jsonResponse({
        issuer: "https://auth.example.test/realms/demo",
        token_endpoint: "https://internal-keycloak.example.test/token",
      }),
  });
  await assert.rejects(() => discovery.metadata(["token_endpoint"]), /must use the issuer origin/);
});

test("drops a failed discovery request so a later attempt can recover", async () => {
  let calls = 0;
  const discovery = new HankoDiscovery("https://auth.example.test/realms/demo", {
    fetch: async () => {
      calls += 1;
      return calls === 1
        ? jsonResponse({}, 503)
        : jsonResponse({
            issuer: "https://auth.example.test/realms/demo",
            token_endpoint: "https://auth.example.test/realms/demo/token",
          });
    },
  });

  await assert.rejects(() => discovery.metadata(["token_endpoint"]), /status 503/);
  await discovery.metadata(["token_endpoint"]);
  assert.equal(calls, 2);
});

test("rejects discovery issuer substitution", async () => {
  const discovery = new HankoDiscovery("https://auth.example.test/realms/demo", {
    fetch: async () =>
      jsonResponse({
        issuer: "https://attacker.example.test/realms/demo",
        token_endpoint: "https://auth.example.test/realms/demo/token",
      }),
  });
  await assert.rejects(() => discovery.metadata(["token_endpoint"]), /issuer does not match/);
});
