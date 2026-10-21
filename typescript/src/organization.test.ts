import assert from "node:assert/strict";
import test from "node:test";

import { HankoOrganizationClient } from "./organization.js";

test("manages organization positions with the caller's short-lived token", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const client = new HankoOrganizationClient({
    apiUrl: "https://api.hanko.example",
    accessToken: () => "short-lived-token",
    fetch: async (input, init) => {
      requests.push({ url: String(input), ...(init === undefined ? {} : { init }) });
      if (init?.method === "POST") {
        return Response.json({ id: "pos_1", realm: "shared", title: "R&D", role_ids: [] }, { status: 201 });
      }
      return Response.json({ positions: [{ id: "pos_1", realm: "shared", title: "R&D", role_ids: [] }] });
    },
  });

  const created = await client.createPosition("shared", { title: "R&D", role_ids: [] });
  const positions = await client.listPositions("shared");
  assert.equal(created.id, "pos_1");
  assert.equal(positions.length, 1);
  assert.equal(requests[0]?.init?.headers && (requests[0].init.headers as Record<string, string>).Authorization, "Bearer short-lived-token");
  assert.equal(requests[0]?.url, "https://api.hanko.example/api/v1/realms/shared/org/positions");
});

test("updates and deletes positions, tolerating an already-deleted node", async () => {
  const requests: Array<{ url: string; method?: string }> = [];
  const client = new HankoOrganizationClient({
    apiUrl: "https://api.hanko.example",
    accessToken: () => "short-lived-token",
    fetch: async (input, init) => {
      requests.push({ url: String(input), ...(init?.method === undefined ? {} : { method: init.method }) });
      return new Response(null, { status: init?.method === "DELETE" ? 404 : 204 });
    },
  });

  await client.updatePosition("shared", "pos_1", { title: "R&D", role_ids: ["dev"] });
  await client.deletePosition("shared", "pos_1");
  assert.deepEqual(requests, [
    { url: "https://api.hanko.example/api/v1/realms/shared/org/positions/pos_1", method: "PATCH" },
    { url: "https://api.hanko.example/api/v1/realms/shared/org/positions/pos_1", method: "DELETE" },
  ]);
});

test("fails closed on an empty token and an unexpected status", async () => {
  const emptyToken = new HankoOrganizationClient({
    apiUrl: "https://api.hanko.example",
    accessToken: () => "  ",
    fetch: async () => Response.json({ positions: [] }),
  });
  await assert.rejects(emptyToken.listPositions("shared"), /access token is empty/);

  const denied = new HankoOrganizationClient({
    apiUrl: "https://api.hanko.example",
    accessToken: () => "short-lived-token",
    fetch: async () => new Response(null, { status: 403 }),
  });
  await assert.rejects(denied.listPositions("shared"), /returned status 403/);
});

test("rejects an unsafe management URL", () => {
  assert.throws(() => new HankoOrganizationClient({
    apiUrl: "http://hanko.example",
    accessToken: () => "token",
    fetch,
  }), /HTTPS/);
});
