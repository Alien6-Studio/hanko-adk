import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { HankoIamClient } from "./iam.js";

interface ContractCase {
  operation: string; args: unknown[]; method: string; path: string;
  body?: unknown; status: number; response?: unknown; result?: unknown;
}
const cases = JSON.parse(readFileSync(new URL("../testdata/iam-contract.json", import.meta.url), "utf8")) as ContractCase[];

for (const entry of cases) {
  test(`shared IAM contract: ${entry.operation}`, async () => {
    let calls = 0;
    const client = new HankoIamClient({
      apiUrl: "https://api.example.test", accessToken: () => "current-token",
      fetch: async (input, init) => {
        calls++;
        assert.equal(String(input), `https://api.example.test${entry.path}`);
        assert.equal(init?.method, entry.method);
        assert.equal(init?.redirect, "error");
        assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer current-token");
        assert.deepEqual(init?.body ? JSON.parse(String(init.body)) : undefined, entry.body);
        return entry.response === undefined ? new Response(null, { status: entry.status }) : Response.json(entry.response, { status: entry.status });
      },
    });
    const method = client[entry.operation as keyof HankoIamClient] as (...args: unknown[]) => Promise<unknown>;
    assert.deepEqual(await method.apply(client, entry.args), entry.result);
    assert.equal(calls, 1);
  });
}

test("IAM preserves denied and missing resources without silently succeeding", async () => {
  for (const status of [401, 403, 404, 409, 503]) {
    const client = new HankoIamClient({ apiUrl: "https://api.example.test", accessToken: () => "token", fetch: async () => new Response("private provider detail", { status }) });
    await assert.rejects(client.assignRole("shared", "alice", "reader"), new RegExp(`status ${status}$`));
    await assert.rejects(client.removeMember("shared", "engineering", "alice"), new RegExp(`status ${status}$`));
  }
});

test("IAM rejects unsafe identifiers before resolving credentials or sending requests", async () => {
  const client = new HankoIamClient({ apiUrl: "https://api.example.test", accessToken: () => { throw new Error("must not resolve"); }, fetch: async () => { throw new Error("must not send"); } });
  for (const value of ["", ".", "..", "x/y", "x\\y", "x\ny", " shared"]) {
    await assert.rejects(async () => client.listUsers(value), /path identifier/);
    await assert.rejects(async () => client.getUser("shared", value), /path identifier/);
    await assert.rejects(async () => client.unassignRole("shared", "alice", value), /path identifier/);
    await assert.rejects(async () => client.getPosition("shared", value), /path identifier/);
  }
});

test("IAM requires the actual API envelope and resolves a fresh access token per call", async () => {
  let tokens = 0;
  const client = new HankoIamClient({
    apiUrl: "https://api.example.test", accessToken: () => `token-${++tokens}`,
    fetch: async (_input, init) => {
      assert.equal(new Headers(init?.headers).get("Authorization"), `Bearer token-${tokens}`);
      return Response.json([]); // A raw array is not Hanko's {users: [...]} response.
    },
  });
  await assert.rejects(client.listUsers("shared"), /Invalid Hanko IAM list response/);
  await assert.rejects(client.listRoles("shared"), /Invalid Hanko IAM list response/);
  await assert.rejects(client.listUserRoles("shared", "alice"), /Invalid Hanko IAM list response/);
  await assert.rejects(client.listMembers("shared", "engineering"), /Invalid Hanko members response/);
  assert.equal(tokens, 4);
});
