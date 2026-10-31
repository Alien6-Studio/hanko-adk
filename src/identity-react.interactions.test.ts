import assert from "node:assert/strict";
import { after, afterEach, test } from "node:test";
import { createElement as h, act, type ChangeEvent } from "react";
import { JSDOM } from "jsdom";
import {
  HankoIdentityScreen,
  HankoIdentityView,
  useHankoAccount,
  useHankoOrganization,
  useHankoIdentityMutation,
  type HankoIdentityUI,
} from "./identity-react.js";
import type {
  HankoAccountSummary,
  HankoIdentityController,
  HankoOrganizationDetails,
} from "./identity.js";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://app.example.test",
});
for (const name of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLInputElement",
  "FormData",
] as const) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value: name === "window" ? dom.window : dom.window[name],
  });
}
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  writable: true,
  value: true,
});
const { render, renderHook, fireEvent, within, waitFor, cleanup } =
  await import("@testing-library/react");
afterEach(cleanup);
after(() => dom.window.close());

const ui: HankoIdentityUI = {
  Page: ({ title, description, children }) =>
    h(
      "main",
      null,
      h("h1", null, title),
      description && h("p", null, description),
      children,
    ),
  Section: ({ title, children }) =>
    h("section", null, title && h("h2", null, title), children),
  Group: ({ children }) => h("div", null, children),
  Field: ({ label, htmlFor, children }) =>
    h("label", { htmlFor }, label, children),
  Input: (props) => h("input", props),
  Textarea: (props) => h("textarea", props),
  Select: ({ id, value, disabled, onValueChange, options }) =>
    h(
      "select",
      {
        id,
        value,
        disabled,
        onChange: (e: ChangeEvent<HTMLSelectElement>) =>
          onValueChange(e.currentTarget.value),
      },
      options.map((o) =>
        h("option", { key: o.value, value: o.value }, o.label),
      ),
    ),
  Button: ({ tone: _tone, ...props }) => h("button", props),
  Status: ({ role, children }) => h("p", { role }, children),
  Values: ({ items }) =>
    h(
      "dl",
      null,
      items.map((item, index) =>
        h(
          "div",
          { key: index },
          h("dt", null, item.label),
          h("dd", null, item.value),
        ),
      ),
    ),
  Members: ({ members, renderActions }) =>
    h(
      "ul",
      null,
      members.map((member) =>
        h(
          "li",
          { key: member.id },
          h("span", null, member.name),
          renderActions?.(member),
        ),
      ),
    ),
};

function fixture() {
  const f = {
    account: {
      subject: "alice",
      name: "Alice",
      email: "alice@example.test",
      roles: ["reader"],
      organizations: [{ id: "one", name: "One" }],
      canCreateOrganization: true,
    } as HankoAccountSummary,
    details: {
      organization: {
        id: "one",
        name: "One",
        description: "About One",
        website: "https://one.example.test",
        email: "one@example.test",
      },
      members: [
        { id: "bob", name: "Bob", role: "reader" },
        {
          id: "owner",
          name: "Protected owner",
          role: "editor",
          manageable: false,
        },
      ],
      roles: [
        { id: "reader", name: "Reader" },
        { id: "editor", name: "Editor" },
      ],
      permissions: { edit: true, invite: true, manageMembers: true },
    } as HankoOrganizationDetails,
    calls: [] as unknown[][],
    controller: undefined as unknown as HankoIdentityController,
  };
  f.controller = {
    account: async (signal) => {
      f.calls.push(["account", signal]);
      return f.account;
    },
    organization: async (id, signal) => {
      f.calls.push(["organization", id, signal]);
      return f.details;
    },
    createOrganization: async (input, signal) => {
      f.calls.push(["create", input, signal]);
    },
    updateOrganization: async (id, input, signal) => {
      f.calls.push(["update", id, input, signal]);
    },
    inviteMember: async (id, input, signal) => {
      f.calls.push(["invite", id, input, signal]);
    },
    changeMemberRole: async (id, member, role, signal) => {
      f.calls.push(["role", id, member, role, signal]);
    },
    removeMember: async (id, member, signal) => {
      f.calls.push(["remove", id, member, signal]);
    },
  };
  return f;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function screen(f: ReturnType<typeof fixture>) {
  return render(
    h(HankoIdentityScreen, {
      subject: "alice",
      controller: f.controller,
      ui,
      page: "organizations",
    }),
  );
}

test("account queries discard old sessions, reject mismatched subjects and allow retry", async () => {
  const f = fixture();
  const pending: ReturnType<typeof deferred<HankoAccountSummary>>[] = [];
  const signals: AbortSignal[] = [];
  f.controller.account = (signal) => {
    signals.push(signal);
    const d = deferred<HankoAccountSummary>();
    pending.push(d);
    return d.promise;
  };
  const r = renderHook(
    ({ subject }) => useHankoAccount(subject, f.controller),
    { initialProps: { subject: "alice" } },
  );
  const data = () => r.result.current.data;
  r.rerender({ subject: "bob" });
  assert.equal(signals[0]!.aborted, true);
  await act(async () => pending[0]!.resolve(f.account));
  assert.equal(data(), undefined);
  await act(async () => pending[1]!.resolve(f.account));
  assert.equal(r.result.current.error, true);
  await act(async () => r.result.current.reload());
  await act(async () =>
    pending[2]!.resolve({ ...f.account, subject: "bob", name: "Bob" }),
  );
  assert.equal(data()?.subject, "bob");
  r.rerender({ subject: "charlie" });
  r.unmount();
  assert.equal(signals[3]!.aborted, true);
  await act(async () =>
    pending[3]!.reject(new Error("canceled provider read")),
  );
});

test("organization queries discard stale selections and support error recovery", async () => {
  const f = fixture();
  const pending: ReturnType<typeof deferred<HankoOrganizationDetails>>[] = [];
  const signals: AbortSignal[] = [];
  f.controller.organization = (_id, signal) => {
    signals.push(signal);
    const d = deferred<HankoOrganizationDetails>();
    pending.push(d);
    return d.promise;
  };
  const r = renderHook(({ id }) => useHankoOrganization(id, f.controller), {
    initialProps: { id: "one" },
  });
  const data = () => r.result.current.data;
  r.rerender({ id: "two" });
  assert.equal(signals[0]!.aborted, true);
  await act(async () => pending[0]!.resolve(f.details));
  assert.equal(data(), undefined);
  await act(async () => pending[1]!.reject(new Error("provider read failed")));
  assert.equal(r.result.current.error, true);
  await act(async () => r.result.current.reload());
  await act(async () =>
    pending[2]!.resolve({
      ...f.details,
      organization: { id: "two", name: "Two" },
    }),
  );
  assert.equal(data()?.organization.id, "two");
  r.rerender({ id: "three" });
  r.unmount();
  await act(async () =>
    pending[3]!.reject(new Error("canceled provider read")),
  );
  assert.equal(signals[3]!.aborted, true);
});

test("mutations prevent duplicate submissions, recover from errors and abort on unmount", async () => {
  const r = renderHook(useHankoIdentityMutation);
  const pending = deferred<void>();
  let operation!: Promise<boolean>;
  await act(async () => {
    operation = r.result.current.run(() => pending.promise);
  });
  assert.equal(r.result.current.busy, true);
  let duplicates = 0;
  await act(async () =>
    assert.equal(
      await r.result.current.run(() => {
        duplicates++;
      }),
      false,
    ),
  );
  assert.equal(duplicates, 0);
  await act(async () => {
    pending.resolve(undefined);
    assert.equal(await operation, true);
  });
  assert.equal(r.result.current.state, "saved");
  await act(async () =>
    assert.equal(
      await r.result.current.run(() => {
        throw new Error("provider failed");
      }),
      false,
    ),
  );
  assert.equal(r.result.current.state, "error");
  const late = deferred<void>();
  let signal!: AbortSignal;
  await act(async () => {
    operation = r.result.current.run((s) => {
      signal = s;
      return late.promise;
    });
  });
  r.unmount();
  assert.equal(signal.aborted, true);
  await act(async () => {
    late.resolve(undefined);
    assert.equal(await operation, false);
  });
});

test("native screens recover from failed loading without revealing provider errors", async () => {
  const f = fixture();
  let attempts = 0;
  f.controller.account = async () => {
    if (attempts++ === 0) throw new Error("internal provider details");
    return f.account;
  };
  const view = render(
    h(HankoIdentityScreen, {
      subject: "alice",
      controller: f.controller,
      ui,
      page: "profile",
      title: "Account settings",
      description: "Host-owned page",
    }),
  );
  await view.findByRole("alert");
  assert.doesNotMatch(
    view.container.textContent!,
    /internal provider details/u,
  );
  fireEvent.click(view.getByRole("button", { name: "Try again" }));
  await view.findByRole("heading", { name: "Account settings" });
  assert.ok(view.getByText("Alice"));
  assert.ok(view.getByText("Host-owned page"));
});

test("account actions show failure, permit retry and call only the configured host action", async () => {
  const f = fixture();
  const actions: string[] = [];
  let failure = true;
  const view = render(
    h(HankoIdentityView, {
      subject: "alice",
      controller: f.controller,
      account: f.account,
      ui,
      page: "security",
      reload() {},
      onAccountAction: async (action) => {
        actions.push(action);
        if (failure) throw new Error("failed");
      },
    }),
  );
  fireEvent.click(view.getByRole("button", { name: "Change password" }));
  await view.findByRole("alert");
  failure = false;
  fireEvent.click(view.getByRole("button", { name: "Change password" }));
  await waitFor(() => assert.equal(view.queryByRole("alert") === null, true));
  fireEvent.click(view.getByRole("button", { name: "Sign out" }));
  await waitFor(() =>
    assert.deepEqual(actions, ["password", "password", "logout"]),
  );
});

test("access pages preserve host-owned resources and empty role state", () => {
  const f = fixture();
  const view = render(
    h(HankoIdentityView, {
      subject: "alice",
      controller: f.controller,
      account: {
        ...f.account,
        roles: [],
        resources: [
          { id: "billing", name: "Billing", scopes: ["read", "export"] },
        ],
      },
      ui,
      page: "access",
      reload() {},
    }),
  );
  assert.ok(view.getByText("No role is assigned."));
  assert.ok(view.getByText("Billing"));
  assert.ok(view.getByText("read, export"));
});

test("read-only organizations hide mutations even when the controller implements them", async () => {
  const f = fixture();
  f.account = { ...f.account, canCreateOrganization: false };
  f.details = {
    ...f.details,
    permissions: { edit: false, invite: false, manageMembers: false },
  };
  const view = screen(f);
  await view.findByRole("heading", { name: "One" });
  assert.ok(view.getByText("You have read-only access to this organization."));
  assert.equal(view.container.querySelector("form"), null);
  assert.equal(view.queryByRole("button"), null);
  assert.equal(
    f.calls.some((c) =>
      ["update", "invite", "role", "remove", "create"].includes(c[0] as string),
    ),
    false,
  );
});

test("organization edits update both the details and account labels", async () => {
  const f = fixture();
  const view = screen(f);
  const section = within(
    (await view.findByRole("heading", { name: "One" })).closest("section")!,
  );
  fireEvent.change(section.getByLabelText("Name"), {
    target: { value: "Renamed" },
  });
  fireEvent.change(section.getByLabelText("Description"), {
    target: { value: "Updated description" },
  });
  fireEvent.submit(
    section.getByRole("button", { name: "Save" }).closest("form")!,
  );
  await waitFor(() =>
    assert.deepEqual(f.calls.find((c) => c[0] === "update")?.slice(0, 3), [
      "update",
      "one",
      {
        name: "Renamed",
        description: "Updated description",
        website: "https://one.example.test",
        email: "one@example.test",
      },
    ]),
  );
  await waitFor(() =>
    assert.ok(
      f.calls.filter((c) => c[0] === "account").length >= 2 &&
        f.calls.filter((c) => c[0] === "organization").length >= 2,
    ),
  );
});

test("editing a supported field preserves a fixed name and omits unsupported fields", async () => {
  const f = fixture();
  f.details = {
    ...f.details,
    editableFields: ["description"],
    membersAvailable: false,
    members: [],
    permissions: { edit: true, invite: false, manageMembers: false },
  };
  const view = screen(f);
  const section = within(
    (await view.findByRole("heading", { name: "One" })).closest("section")!,
  );
  assert.equal(section.queryByLabelText("Name"), null);
  assert.equal(view.queryByRole("heading", { name: "Members" }), null);
  fireEvent.change(section.getByLabelText("Description"), {
    target: { value: "Changed" },
  });
  fireEvent.submit(
    section.getByRole("button", { name: "Save" }).closest("form")!,
  );
  await waitFor(() =>
    assert.deepEqual(f.calls.find((c) => c[0] === "update")?.slice(0, 3), [
      "update",
      "one",
      { description: "Changed", name: "One" },
    ]),
  );
});

test("invitation and role forms submit the selected application role", async () => {
  const f = fixture();
  const view = screen(f);
  const invitation = within(
    (await view.findByRole("heading", { name: "Invite" })).closest("section")!,
  );
  fireEvent.change(invitation.getByLabelText("Email"), {
    target: { value: "new@example.test" },
  });
  fireEvent.change(invitation.getByLabelText("Role"), {
    target: { value: "editor" },
  });
  fireEvent.submit(
    invitation.getByRole("button", { name: "Invite" }).closest("form")!,
  );
  await waitFor(() =>
    assert.deepEqual(f.calls.find((c) => c[0] === "invite")?.slice(0, 3), [
      "invite",
      "one",
      { email: "new@example.test", role: "editor" },
    ]),
  );
  const member = within(view.getByText("Bob").closest("li")!);
  fireEvent.change(member.getByLabelText("Role"), {
    target: { value: "editor" },
  });
  fireEvent.submit(
    member.getByRole("button", { name: "Save" }).closest("form")!,
  );
  await waitFor(() =>
    assert.deepEqual(f.calls.find((c) => c[0] === "role")?.slice(0, 4), [
      "role",
      "one",
      "bob",
      "editor",
    ]),
  );
  assert.equal(
    within(view.getByText("Protected owner").closest("li")!).queryByRole(
      "button",
    ),
    null,
  );
});

test("member removal requires confirmation, supports cancellation and retains a failed request for retry", async () => {
  const f = fixture();
  let attempts = 0;
  f.controller.removeMember = async (id, member, signal) => {
    f.calls.push(["remove", id, member, signal]);
    if (attempts++ === 0) throw new Error("provider failed");
    f.details = {
      ...f.details,
      members: f.details.members.filter((m) => m.id !== member),
    };
  };
  const view = screen(f);
  await view.findByText("Bob");
  const row = within(view.getByText("Bob").closest("li")!);
  fireEvent.click(row.getByRole("button", { name: "Remove" }));
  fireEvent.click(row.getByRole("button", { name: "Cancel" }));
  assert.equal(attempts, 0);
  fireEvent.click(row.getByRole("button", { name: "Remove" }));
  fireEvent.click(row.getByRole("button", { name: "Confirm removal" }));
  await row.findByRole("alert");
  assert.equal(attempts, 1);
  fireEvent.click(row.getByRole("button", { name: "Confirm removal" }));
  await waitFor(() => assert.equal(view.queryByText("Bob") === null, true));
  assert.equal(attempts, 2);
  assert.deepEqual(
    f.calls.filter((c) => c[0] === "remove").map((c) => c.slice(0, 3)),
    [
      ["remove", "one", "bob"],
      ["remove", "one", "bob"],
    ],
  );
});

test("creation is explicit and organization switching reads only the selected organization", async () => {
  const f = fixture();
  f.account = {
    ...f.account,
    organizations: [
      { id: "one", name: "One" },
      { id: "two", name: "Two" },
    ],
  };
  f.controller.organization = async (id, signal) => {
    f.calls.push(["organization", id, signal]);
    return {
      ...f.details,
      organization: { id, name: id === "one" ? "One" : "Two" },
    };
  };
  const view = screen(f);
  await view.findByRole("heading", { name: "One" });
  fireEvent.change(view.getByLabelText("Organizations"), {
    target: { value: "two" },
  });
  await view.findByRole("heading", { name: "Two" });
  assert.equal(
    f.calls.filter((c) => c[0] === "organization").at(-1)?.[1],
    "two",
  );
  fireEvent.click(view.getByRole("button", { name: "Create organization" }));
  fireEvent.click(view.getByRole("button", { name: "Cancel" }));
  assert.equal(view.queryByLabelText("Identifier"), null);
  fireEvent.click(view.getByRole("button", { name: "Create organization" }));
  const create = view.getByLabelText("Identifier").closest("form")!;
  const form = within(create);
  fireEvent.change(form.getByLabelText("Name"), {
    target: { value: "New organization" },
  });
  fireEvent.change(form.getByLabelText("Identifier"), {
    target: { value: "new-organization" },
  });
  fireEvent.submit(create);
  await waitFor(() =>
    assert.deepEqual(f.calls.find((c) => c[0] === "create")?.slice(0, 2), [
      "create",
      { name: "New organization", slug: "new-organization" },
    ]),
  );
});
