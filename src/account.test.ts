import assert from "node:assert/strict";
import test from "node:test";
import { hankoAccountAction } from "./account.js";

test("self-service actions add native parameters without replacing the OIDC request", () => {
  const authorization = { state: "owned-by-the-oidc-client", code_challenge: "owned-by-the-oidc-client", ...hankoAccountAction("profile") };
  assert.equal(authorization.kc_action, "UPDATE_PROFILE");
  assert.equal(authorization.state, "owned-by-the-oidc-client");
  assert.equal(hankoAccountAction("otp").kc_action, "CONFIGURE_TOTP");
  assert.throws(() => hankoAccountAction("constructor" as "profile"));
});
