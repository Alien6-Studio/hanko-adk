import assert from "node:assert/strict";
import test from "node:test";

import { createHankoPrincipal } from "./principal.js";

test("creates a normalized principal keyed by issuer and subject", () => {
  const principal = createHankoPrincipal(
    {
      iss: "https://auth.example.test/realms/demo",
      sub: "user-123",
      aud: ["account", "signal-api"],
      email: "user@example.test",
    },
    "https://auth.example.test/realms/demo",
    "signal-api",
  );

  assert.equal(principal.issuer, "https://auth.example.test/realms/demo");
  assert.equal(principal.subject, "user-123");
  assert.deepEqual(principal.audiences, ["account", "signal-api"]);
});

test("rejects issuer and audience substitution", () => {
  assert.throws(
    () =>
      createHankoPrincipal(
        { iss: "https://attacker.example.test/realms/demo", sub: "user-123", aud: "signal-api" },
        "https://auth.example.test/realms/demo",
        "signal-api",
      ),
    /issuer does not match/,
  );
  assert.throws(
    () =>
      createHankoPrincipal(
        { iss: "https://auth.example.test/realms/demo", sub: "user-123", aud: "other-api" },
        "https://auth.example.test/realms/demo",
        "signal-api",
      ),
    /configured audience/,
  );
});

test("rejects malformed audience claims", () => {
  assert.throws(
    () =>
      createHankoPrincipal(
        {
          iss: "https://auth.example.test/realms/demo",
          sub: "user-123",
          aud: ["signal-api", 42] as unknown as string[],
        },
        "https://auth.example.test/realms/demo",
      ),
    /invalid audience/,
  );
});

test("compares the verified issuer exactly", () => {
  assert.throws(
    () =>
      createHankoPrincipal(
        { iss: "https://auth.example.test/realms/demo/", sub: "user-123" },
        "https://auth.example.test/realms/demo",
      ),
    /issuer does not match/,
  );
});
