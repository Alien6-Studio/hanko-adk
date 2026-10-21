import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { HankoDelegatedOrganizationClient, HankoIamClient } from "./index.js";

interface ContractCase {
  client: string; operation: string; args: unknown[]; method: string; path: string;
  body?: unknown; status: number; response?: unknown; result?: unknown;
}
const cases = JSON.parse(readFileSync(new URL("../testdata/organization-administration.json", import.meta.url), "utf8")) as ContractCase[];
const target = { realm: "example", applicationId: "product-api", rootPositionId: "root" };

for (const entry of cases) {
  test(`shared organization administration contract: ${entry.operation}`, async () => {
    let calls = 0;
    const options = {
      apiUrl: "https://api.example.test", accessToken: () => "current-credential",
      fetch: async (input: string | URL | Request, init?: RequestInit) => {
        calls++;
        assert.equal(String(input), `https://api.example.test${entry.path}`);
        assert.equal(init?.method, entry.method);
        assert.equal(init?.redirect, "error");
        assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer current-credential");
        assert.deepEqual(init?.body ? JSON.parse(String(init.body)) : undefined, entry.body);
        return entry.response === undefined ? new Response(null, { status: entry.status }) : Response.json(entry.response, { status: entry.status });
      },
    };
    const client = entry.client === "delegated" ? new HankoDelegatedOrganizationClient({ ...options, ...target }) : new HankoIamClient(options);
    const method = (client as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>)[entry.operation]!;
    assert.deepEqual(await method.apply(client, entry.args), entry.result);
    assert.equal(calls, 1);
  });
}

test("delegated clients keep the configured target, rotate credentials and preserve refusals", async () => {
  let credentials = 0;
  const options = { apiUrl: "https://api.example.test", ...target, accessToken: () => `credential-${++credentials}`,
    fetch: async (input: string | URL | Request, init?: RequestInit) => {
      assert.match(String(input), /\/applications\/product-api\/roots\/root\/positions\/readers\/members$/u);
      assert.equal(new Headers(init?.headers).get("Authorization"), `Bearer credential-${credentials}`);
      return new Response(null, { status: 204 });
    } };
  const client = new HankoDelegatedOrganizationClient(options);
  options.rootPositionId = "foreign";
  await client.assignMember("readers", "alice");
  await client.assignMember("readers", "bob");
  assert.equal(credentials, 2);
  for (const status of [401, 403, 404, 409, 503]) {
    const denied = new HankoDelegatedOrganizationClient({ ...options, ...target, fetch: async () => new Response("private detail", { status }) });
    await assert.rejects(denied.assignMember("readers", "alice"), new RegExp(`status ${status}$`));
    await assert.rejects(denied.removeMember("readers", "alice"), new RegExp(`status ${status}$`));
  }
});

test("delegated clients reject ambiguous targets and missing API envelopes", async () => {
  const options = { apiUrl: "https://api.example.test", ...target, accessToken: () => "credential", fetch: async () => Response.json({}) };
  for (const value of ["", ".", "..", "x/y", "x%2fy", "x?y", "two words", "x".repeat(256)]) {
    for (const field of ["realm", "applicationId", "rootPositionId"]) assert.throws(() => new HankoDelegatedOrganizationClient({ ...options, [field]: value }), /path identifier/u);
    await assert.rejects(new HankoDelegatedOrganizationClient(options).assignMember(value, "alice"), /path identifier/u);
    await assert.rejects(new HankoDelegatedOrganizationClient(options).removeMember("readers", value), /path identifier/u);
  }
  await assert.rejects(new HankoDelegatedOrganizationClient(options).listPositions(), /Invalid Hanko delegated positions/u);
  await assert.rejects(new HankoDelegatedOrganizationClient(options).listMembers("readers"), /Invalid Hanko members/u);
  await assert.rejects(new HankoIamClient(options).listOrganizationDelegations("example"), /Invalid Hanko/u);
});
