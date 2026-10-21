import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { createHankoAuthJsProvider, refreshHankoAccessToken } from "./authjs.js";
import type { HankoFetch } from "./discovery.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const config = {
  issuer: "https://auth.example.test/realms/demo",
  clientId: "example-dashboard",
  clientSecret: "secret",
};

test("creates the mandatory Auth.js OIDC provider checks", () => {
  const provider = createHankoAuthJsProvider({ ...config, issuer: `${config.issuer}/` });
  assert.equal(provider.id, "hanko");
  assert.deepEqual(provider.checks, ["pkce", "state", "nonce"]);
  assert.equal(provider.options?.issuer, config.issuer);
  assert.equal(provider.options?.clientId, config.clientId);
});

test("preserves security after Auth.js normalizes the actual provider", async () => {
  const require = createRequire(import.meta.url);
  const parser = pathToFileURL(join(dirname(require.resolve("@auth/core")), "lib/utils/providers.js")).href;
  const { default: parseProviders } = await import(parser);
  const provider = createHankoAuthJsProvider(config, { name: "Example login" });
  const { providers } = parseProviders({ url: new URL("https://app.example.test/auth"), config: { providers: [provider] } });
  assert.deepEqual(providers[0].checks, ["pkce", "state", "nonce"]);
  assert.equal(providers[0].issuer, config.issuer);
  for (const value of [{ checks: ["none", "none", "none"] }, { token: "https://other.example.test/token" },
    { authorization: "https://other.example.test/login" }, { wellKnown: "https://other.example.test" }]) {
    assert.throws(() => createHankoAuthJsProvider(config, value as Parameters<typeof createHankoAuthJsProvider>[1]), /Unsupported/);
  }
});

test("refreshes a token through discovered Hanko metadata", async () => {
  const requests: string[] = [];
  const fetcher: HankoFetch = async (input, init) => {
    const url = input.toString();
    requests.push(url);
    if (url.endsWith("/.well-known/openid-configuration")) {
      return jsonResponse({
        issuer: "https://auth.example.test/realms/demo",
        token_endpoint: "https://auth.example.test/realms/demo/token",
      });
    }
    assert.equal(init?.method, "POST");
    assert.match(String(init?.body), /grant_type=refresh_token/);
    return jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", expires_in: 300, hanko_upstream_id_token: "new-logout-hint" });
  };

  const refreshed = await refreshHankoAccessToken(
    { accessToken: "old", refreshToken: "refresh", expiresAt: 1 },
    config,
    { fetch: fetcher, now: () => 1_000_000 },
  );

  assert.equal(refreshed.accessToken, "new-access");
  assert.equal(refreshed.refreshToken, "new-refresh");
  assert.equal(refreshed.expiresAt, 1300);
  assert.equal(refreshed.error, undefined);
  assert.equal(refreshed.logoutToken, "new-logout-hint");
  assert.equal(requests.length, 2);
});

test("fails closed when refresh is unavailable", async () => {
  const refreshed = await refreshHankoAccessToken({ accessToken: "old" }, config);
  assert.equal(refreshed.error, "HankoRefreshTokenError");
  assert.equal(refreshed.accessToken, "old");
});
