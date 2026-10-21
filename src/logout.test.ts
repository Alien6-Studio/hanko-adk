import assert from "node:assert/strict";
import test from "node:test";
import { createHankoLogoutUrl, getHankoLogoutToken } from "./logout.js";
const config = { issuer: "https://auth.example.test/realms/qa", clientId: "signal-qa" };
const request = { logoutToken: "upstream-private-hint", postLogoutRedirectUri: "https://signal.example.test/login?logged_out=1" };
const discovery = (endpoint = `${config.issuer}/logout`, issuer = config.issuer) => ({
  fetch: async () => new Response(JSON.stringify({ issuer, end_session_endpoint: endpoint })),
});

test("extracts only the private upstream hint", () => {
  assert.equal(getHankoLogoutToken({ id_token: "public", hanko_upstream_id_token: "private" }), "private");
  for (const value of [undefined, null, 1, "", " "]) {
    assert.equal(getHankoLogoutToken({ id_token: "public", hanko_upstream_id_token: value }), undefined);
  }
});
test("builds RP logout with the discovered endpoint, exact return query and optional state", async () => {
  const url = new URL(await createHankoLogoutUrl(config, { ...request, state: "opaque-state" }, discovery()));
  assert.equal(url.origin, "https://auth.example.test");
  assert.equal(url.pathname, "/realms/qa/logout");
  assert.equal(url.searchParams.get("client_id"), config.clientId);
  assert.equal(url.searchParams.get("id_token_hint"), request.logoutToken);
  assert.equal(url.searchParams.get("post_logout_redirect_uri"), request.postLogoutRedirectUri);
  assert.equal(url.searchParams.get("state"), "opaque-state");
});
test("supports loopback development without inventing state", async () => {
  const url = new URL(await createHankoLogoutUrl(config, { ...request, postLogoutRedirectUri: "http://localhost:3000/login" }, discovery()));
  assert.equal(url.searchParams.has("state"), false);
});
test("rejects missing hints, invalid return URLs and foreign discovery", async () => {
  await assert.rejects(createHankoLogoutUrl(config, { ...request, logoutToken: "" }, discovery()), /upstream/);
  for (const uri of ["http://signal.example.test/login", "https://user:password@signal.example.test/login", "https://signal.example.test/login#fragment", "/login", "javascript:alert(1)"]) {
    await assert.rejects(createHankoLogoutUrl(config, { ...request, postLogoutRedirectUri: uri }, discovery()));
  }
  await assert.rejects(createHankoLogoutUrl(config, request, discovery("https://foreign.example.test/logout")), /issuer origin/);
  await assert.rejects(createHankoLogoutUrl(config, request, discovery(undefined, "https://foreign.example.test")), /issuer/);
  await assert.rejects(createHankoLogoutUrl(config, request, { fetch: async () => new Response("", { status: 503 }) }), /503/);
});
