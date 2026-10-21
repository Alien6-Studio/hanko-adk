import assert from "node:assert/strict";
import test from "node:test";

import {
  loadHankoClientConfig,
  loadHankoResourceServerConfig,
  normalizeHankoClientConfig,
  normalizeHankoIssuer,
} from "./config.js";

test("normalizes the issuer and loads the stable client contract", () => {
  assert.deepEqual(
    loadHankoClientConfig({
      HANKO_ISSUER: "https://auth.example.test/realms/demo/",
      HANKO_CLIENT_ID: "example-dashboard",
      HANKO_CLIENT_SECRET: "secret",
    }),
    {
      issuer: "https://auth.example.test/realms/demo",
      clientId: "example-dashboard",
      clientSecret: "secret",
    },
  );
});

test("requires an audience for resource servers", () => {
  assert.throws(
    () => loadHankoResourceServerConfig({ HANKO_ISSUER: "https://auth.example.test/realms/demo" }),
    /HANKO_AUDIENCE is required/,
  );
});

test("rejects non-HTTPS issuers outside loopback development", () => {
  assert.throws(() => normalizeHankoIssuer("http://auth.example.test/realms/demo"), /must use HTTPS/);
  assert.equal(normalizeHankoIssuer("http://127.0.0.1:8080/realms/demo/"), "http://127.0.0.1:8080/realms/demo");
});

test("normalizes configs supplied directly to public adapters", () => {
  assert.deepEqual(
    normalizeHankoClientConfig({
      issuer: "https://auth.example.test/realms/demo/",
      clientId: " example-dashboard ",
      clientSecret: " secret ",
    }),
    {
      issuer: "https://auth.example.test/realms/demo",
      clientId: "example-dashboard",
      clientSecret: "secret",
    },
  );
  assert.throws(
    () => normalizeHankoClientConfig({ issuer: "https://auth.example.test", clientId: " " }),
    /HANKO_CLIENT_ID is required/,
  );
});
