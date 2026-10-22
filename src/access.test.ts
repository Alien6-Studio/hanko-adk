import assert from "node:assert/strict";
import { test } from "node:test";
import { createHankoPrincipal } from "./principal.js";
import { resolveHankoApplicationAccess } from "./access.js";

const claims = {
  iss: "https://auth.example.test/realms/example",
  sub: "alice",
  aud: "product-api",
  realm_access: { roles: ["global-viewer"] },
  resource_access: {
    "product-api": { roles: ["product-reader"] },
    other: { roles: ["admin"] },
  },
};
function access(extra: object) {
  return resolveHankoApplicationAccess(
    createHankoPrincipal({ ...claims, ...extra }, claims.iss, "product-api"),
    "product-api",
  );
}
test("application access uses only its client roles and the single active organization", () => {
  assert.deepEqual(access({}).roles, ["global-viewer", "product-reader"]);
  const own = access({
    organization: {
      own: {
        id: "org-one",
        groups: ["team"],
        realm_access: { roles: ["org-viewer"] },
        resource_access: {
          "product-api": { roles: ["reader"] },
          other: { roles: ["admin"] },
        },
      },
    },
  });
  assert.deepEqual(own.roles, ["reader"]);
  assert.deepEqual(own.organization, {
    alias: "own",
    id: "org-one",
    groups: ["team"],
  });
  assert.deepEqual(
    access({
      organization: { own: { realm_access: { roles: ["org-reader"] } } },
    }).roles,
    ["org-reader"],
  );
  for (const organization of [
    null,
    [],
    {},
    { one: {}, two: {} },
    { one: 42 },
    { "bad/root": {} },
    {
      one: {
        resource_access: { "product-api": { roles: [42, "admin"] } },
        realm_access: { roles: ["admin"] },
      },
    },
  ])
    assert.deepEqual(access({ organization }).roles, []);
  assert.deepEqual(
    access({ realm_access: { roles: ["admin", 42] }, resource_access: {} })
      .roles,
    [],
  );
  assert.throws(() =>
    resolveHankoApplicationAccess(
      createHankoPrincipal(claims, claims.iss),
      "other",
    ),
  );
});
