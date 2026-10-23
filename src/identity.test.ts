import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createHankoIdentityClient,
  validateHankoAccount,
  validateHankoOrganization,
  type HankoIdentityController,
  type HankoOrganizationDetails,
} from "./identity.js";
import {
  createHankoIdentityHandler,
  createHankoAppearanceProxy,
  createHankoIdentityBackend,
  HankoIdentityError,
} from "./identity-server.js";

const account = {
  subject: "alice",
  name: "Alice",
  email: "alice@example.test",
  roles: ["member"],
  organizations: [{ id: "one", name: "One" }],
  canCreateOrganization: true,
};
const details: HankoOrganizationDetails = {
  organization: account.organizations[0]!,
  members: [{ id: "bob", name: "Bob", role: "member" }],
  roles: [{ id: "member", name: "Member" }],
  permissions: { edit: true, invite: true, manageMembers: true },
};
function setup(overrides: Partial<HankoIdentityController> = {}) {
  const calls: unknown[][] = [];
  const controller: HankoIdentityController = {
    account: async () => account,
    organization: async (id) => {
      calls.push(["read", id]);
      return details;
    },
    createOrganization: async (input) => {
      calls.push(["create", input]);
    },
    updateOrganization: async (id, input) => {
      calls.push(["update", id, input]);
    },
    inviteMember: async (id, input) => {
      calls.push(["invite", id, input]);
    },
    changeMemberRole: async (id, member, role) => {
      calls.push(["role", id, member, role]);
    },
    removeMember: async (id, member) => {
      calls.push(["remove", id, member]);
    },
    ...overrides,
  };
  const handler = createHankoIdentityHandler({
    origin: "https://app.example.test",
    authorize: async () => ({ subject: "alice", controller }),
  });
  const send = (value: unknown, headers: Record<string, string> = {}) =>
    handler(
      new Request("http://internal/api/identity", {
        method: "POST",
        headers: {
          origin: "https://app.example.test",
          "content-type": "application/json",
          ...headers,
        },
        body: JSON.stringify(value),
      }),
    );
  return { calls, handler, send };
}

test("identity reads bind current session subject and organization membership", async () => {
  const { handler, calls } = setup();
  const response = await handler(
    new Request("https://app.example.test/api/identity"),
  );
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), account);
  assert.equal(
    (
      await handler(
        new Request("https://app.example.test/api/identity?organization=other"),
      )
    ).status,
    404,
  );
  assert.deepEqual(calls, []);
  assert.deepEqual(
    await (
      await handler(
        new Request("https://app.example.test/api/identity?organization=one"),
      )
    ).json(),
    details,
  );
  const anonymous = createHankoIdentityHandler({ authorize: async () => null });
  assert.equal(
    (await anonymous(new Request("https://app.example.test/api/identity")))
      .status,
    401,
  );
  assert.equal(
    (
      await handler(
        new Request("https://app.example.test/api/identity", {
          method: "DELETE",
        }),
      )
    ).status,
    405,
  );
  const wrongIdentity = setup({
    account: async () => ({ ...account, subject: "mallory" }),
  });
  assert.equal(
    (
      await wrongIdentity.handler(
        new Request("https://app.example.test/api/identity"),
      )
    ).status,
    502,
  );
  const wrongOrganization = setup({
    organization: async () => ({
      ...details,
      organization: { id: "other", name: "Other" },
    }),
  });
  assert.equal(
    (
      await wrongOrganization.handler(
        new Request("https://app.example.test/api/identity?organization=one"),
      )
    ).status,
    502,
  );
});

test("identity mutations enforce origin, current permissions, role allowlist and tenant membership", async () => {
  const { send, calls } = setup();
  const input = {
    action: "changeMemberRole",
    organization: "one",
    member: "bob",
    role: "member",
  };
  assert.equal(
    (await send(input, { origin: "https://attacker.example.test" })).status,
    403,
  );
  assert.equal(
    (await send(input, { "sec-fetch-site": "cross-site" })).status,
    403,
  );
  assert.equal(
    (await send(input, { "content-type": "text/plain" })).status,
    400,
  );
  assert.equal((await send({ ...input, organization: "other" })).status, 404);
  assert.equal(
    (await send({ ...input, member: "foreign-member" })).status,
    404,
  );
  assert.equal((await send({ ...input, role: "realm-admin" })).status, 403);
  assert.equal((await send({ ...input, subject: "admin" })).status, 400);
  assert.equal(
    calls.some((call) => call[0] === "role"),
    false,
  );
  assert.equal((await send(input)).status, 204);
  assert.deepEqual(calls.at(-1), ["role", "one", "bob", "member"]);
  const reader = setup({
    organization: async () => ({
      ...details,
      permissions: { edit: false, invite: false, manageMembers: false },
    }),
  });
  for (const value of [
    input,
    { action: "removeMember", organization: "one", member: "bob" },
    {
      action: "updateOrganization",
      organization: "one",
      input: { name: "Renamed" },
    },
    {
      action: "inviteMember",
      organization: "one",
      input: { email: "new@example.test", role: "member" },
    },
  ])
    assert.equal((await reader.send(value)).status, 403);
  assert.deepEqual(reader.calls, []);
});

test("identity writes validate inputs and preserve backend enforcement", async () => {
  const { send, calls } = setup();
  assert.equal(
    (
      await send({
        action: "createOrganization",
        input: { name: "New", slug: "new-org" },
      })
    ).status,
    204,
  );
  assert.equal(
    (
      await send({
        action: "updateOrganization",
        organization: "one",
        input: { name: "New", description: "Description" },
      })
    ).status,
    204,
  );
  assert.equal(
    (
      await send({
        action: "inviteMember",
        organization: "one",
        input: { email: "new@example.test", role: "member" },
      })
    ).status,
    204,
  );
  assert.equal(
    (await send({ action: "removeMember", organization: "one", member: "bob" }))
      .status,
    204,
  );
  assert.deepEqual(calls.at(-1), ["remove", "one", "bob"]);
  for (const input of [
    null,
    [],
    { action: "unknown", organization: "one" },
    { action: "createOrganization", input: { name: 42, slug: "bad" } },
    { action: "createOrganization", input: { name: "New", slug: "../admin" } },
    { action: "updateOrganization", organization: "one", input: { name: "" } },
    {
      action: "inviteMember",
      organization: "one",
      input: { email: "invalid", role: "member" },
    },
    {
      action: "inviteMember",
      organization: "one",
      input: { email: "new@example.test", role: "admin" },
    },
    { action: "removeMember", organization: "../other", member: "bob" },
  ])
    assert.equal((await send(input)).status, 400);
  assert.equal(
    (
      await send({
        action: "createOrganization",
        input: { name: "x".repeat(20000), slug: "new" },
      })
    ).status,
    413,
  );
  const noCreate = setup({
    account: async () => ({ ...account, canCreateOrganization: false }),
  });
  assert.equal(
    (
      await noCreate.send({
        action: "createOrganization",
        input: { name: "New", slug: "new" },
      })
    ).status,
    403,
  );
  const denied = setup({
    removeMember: async () => {
      throw new HankoIdentityError(409);
    },
  });
  assert.equal(
    (
      await denied.send({
        action: "removeMember",
        organization: "one",
        member: "bob",
      })
    ).status,
    409,
  );
  const failed = setup({
    account: async () => {
      throw new Error("private upstream secret");
    },
  });
  const result = await failed.handler(
    new Request("https://app.example.test/api/identity"),
  );
  assert.equal(result.status, 502);
  assert.doesNotMatch(await result.text(), /private/);
});

test("identity transport uses only bounded same-origin session requests", async () => {
  const { handler } = setup();
  const requests: { url: string; init?: RequestInit }[] = [];
  const client = createHankoIdentityClient({
    endpoint: "/api/identity",
    fetch: async (url, init) => {
      requests.push({ url: String(url), ...(init ? { init } : {}) });
      return handler(
        new Request(new URL(String(url), "https://app.example.test"), {
          ...init,
          headers: { ...init?.headers, origin: "https://app.example.test" },
        }),
      );
    },
  });
  const signal = new AbortController().signal;
  assert.deepEqual(await client.account(signal), account);
  assert.deepEqual(await client.organization("one", signal), details);
  await client.createOrganization!({ name: "New", slug: "new" }, signal);
  await client.updateOrganization!("one", { name: "New" }, signal);
  await client.inviteMember!(
    "one",
    { email: "new@example.test", role: "member" },
    signal,
  );
  await client.changeMemberRole!("one", "bob", "member", signal);
  await client.removeMember!("one", "bob", signal);
  assert.equal(requests[0]?.init?.credentials, "same-origin");
  assert.equal(requests[0]?.init?.redirect, "error");
  for (const endpoint of [
    "https://outside.example.test",
    "//outside",
    "/path?query",
    "/\\outside",
  ])
    assert.throws(() => createHankoIdentityClient({ endpoint }));
});

test("invalid and duplicate backend data fail closed before rendering", () => {
  assert.throws(() =>
    validateHankoAccount(
      {
        ...account,
        organizations: [...account.organizations, ...account.organizations],
      },
      "alice",
    ),
  );
  assert.throws(() =>
    validateHankoAccount(
      {
        ...account,
        resources: [
          {
            id: "resource",
            name: "Resource",
            scopes: [42 as unknown as string],
          },
        ],
      },
      "alice",
    ),
  );
  assert.throws(() =>
    validateHankoOrganization(
      { ...details, members: [...details.members, ...details.members] },
      "one",
    ),
  );
  validateHankoAccount(
    {
      ...account,
      resources: [{ id: "resource", name: "Resource", scopes: ["read"] }],
    },
    "alice",
  );
});

test("appearance proxy forwards public presentation without session credentials and fails safely", async () => {
  const profile = {
    contract: "hanko.appearance/v1",
    revision: "one",
    appearance: { headline: "Client" },
  };
  const proxy = createHankoAppearanceProxy({
    url: "https://api.example.test/appearance",
    fetch: async (_url, init) => {
      assert.equal(init?.credentials, "omit");
      assert.equal(init?.redirect, "error");
      assert.equal(new Headers(init?.headers).has("authorization"), false);
      return Response.json(profile);
    },
  });
  assert.deepEqual(await (await proxy()).json(), profile);
  assert.throws(() =>
    createHankoAppearanceProxy({ url: "https://user:pass@example.test" }),
  );
  const failed = createHankoAppearanceProxy({
    url: "https://api.example.test/appearance",
    fetch: async () => {
      throw new Error("private detail");
    },
  });
  const response = await failed();
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private detail/);
});

test("server transport rotates credentials and preserves safe backend denials", async () => {
  let token = "first";
  const backend = createHankoIdentityBackend({
    baseUrl: "https://api.example.test/api",
    accessToken: () => token,
    fetch: async (url, init) => {
      assert.equal(init?.redirect, "error");
      assert.equal(
        new Headers(init?.headers).get("authorization"),
        `Bearer ${token}`,
      );
      assert.equal(String(url), "https://api.example.test/api/users");
      return Response.json({ ok: true }, { status: 201 });
    },
  });
  const signal = new AbortController().signal;
  assert.deepEqual(await backend("/users", signal), { ok: true });
  token = "second";
  await backend("/users", signal, "POST", { name: "New" });
  await assert.rejects(backend("//outside", signal));
  assert.throws(() =>
    createHankoIdentityBackend({
      baseUrl: "https://user:pass@api.example.test",
      accessToken: () => "token",
    }),
  );
  for (const status of [403, 409, 500]) {
    const denied = createHankoIdentityBackend({
      baseUrl: "https://api.example.test",
      accessToken: () => "token",
      fetch: async () => new Response("private error", { status }),
    });
    await assert.rejects(
      denied("/users", signal),
      (error: unknown) =>
        error instanceof HankoIdentityError &&
        error.status === (status === 500 ? 502 : status),
    );
  }
});

test("organization field capabilities constrain both UI metadata and server writes", async () => {
  for (const editableFields of [["unknown"], ["name", "name"], null, "name"]) {
    assert.throws(() =>
      validateHankoOrganization(
        { ...details, editableFields } as unknown as HankoOrganizationDetails,
        "one",
      ),
    );
  }
  const { send, calls } = setup({
    organization: async () => ({
      ...details,
      editableFields: ["name", "description"],
    }),
  });
  assert.equal(
    (
      await send({
        action: "updateOrganization",
        organization: "one",
        input: { name: "One", website: "https://example.test" },
      })
    ).status,
    403,
  );
  assert.equal(calls.length, 0);
  assert.equal(
    (
      await send({
        action: "updateOrganization",
        organization: "one",
        input: { name: "New name", description: "First line\nSecond line" },
      })
    ).status,
    204,
  );
  assert.deepEqual(calls.at(-1), [
    "update",
    "one",
    { name: "New name", description: "First line\nSecond line" },
  ]);
  const fixedName = setup({
    organization: async () => ({ ...details, editableFields: ["description"] }),
  });
  assert.equal(
    (
      await fixedName.send({
        action: "updateOrganization",
        organization: "one",
        input: { name: "Renamed", description: "Changed" },
      })
    ).status,
    403,
  );
});

test("protected organization members cannot be changed by the identity BFF", async () => {
 const {send,calls}=setup({organization:async()=>({...details,members:details.members.map(member=>({...member,manageable:false}))})});
 for (const action of ["changeMemberRole","removeMember"]) {
  const input={action,organization:"one",member:"bob",...(action==="changeMemberRole"?{role:"member"}:{})};
  assert.equal((await send(input)).status,403);
 }
 assert.equal(calls.some(call=>call[0]==="role"||call[0]==="remove"),false);
});

test("identity transports honor the host's operation deadline", async () => {
 const slow = async () => { await new Promise(resolve => setTimeout(resolve, 30)); return Response.json(account); };
 const controller = createHankoIdentityClient({endpoint:"/api/identity",timeoutMs:5,fetch:slow});
 await assert.rejects(controller.account(new AbortController().signal), /aborted/);
 const backend = createHankoIdentityBackend({baseUrl:"https://api.example.test",accessToken:()=>"user",timeoutMs:5,fetch:slow});
 await assert.rejects(backend("/account",new AbortController().signal), /aborted/);
});
