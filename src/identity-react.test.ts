import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HankoIdentityView, type HankoIdentityUI } from "./identity-react.js";
import type { HankoIdentityController } from "./identity.js";

const ui: HankoIdentityUI = {
  Page: ({ title, children }) =>
    h("main", { "data-host": "page" }, h("h1", null, title), children),
  Section: ({ children }) => h("section", { "data-host": "card" }, children),
  Group: ({ children }) => h("div", null, children),
  Field: ({ children, label, htmlFor }) =>
    h("label", { htmlFor }, label, children),
  Input: (props) => h("input", props),
  Textarea: (props) => h("textarea", props),
  Select: () => h("select"),
  Button: ({ tone: _tone, ...props }) =>
    h("button", { ...props, "data-host": "button" }),
  Status: ({ children, role }) => h("p", { role }, children),
  Values: ({ items }) =>
    h(
      "dl",
      { "data-host": "values" },
      items.map((item, key) =>
        h("div", { key }, h("dt", null, item.label), h("dd", null, item.value)),
      ),
    ),
  Members: () => h("ul"),
};
const account = {
  subject: "alice",
  name: "Alice",
  email: "alice@example.test",
  roles: ["reader"],
  organizations: [],
  canCreateOrganization: false,
};
const controller: HankoIdentityController = {
  account: async () => account,
  organization: async () => {
    throw new Error("unexpected organization read");
  },
};
const props = {
  subject: account.subject,
  controller,
  account,
  ui,
  locale: "fr" as const,
  reload() {},
};

test("native screens render the host's components with no theme, CSS or navigation frame", () => {
  const markup = renderToStaticMarkup(
    h(HankoIdentityView, { ...props, page: "profile", onAccountAction() {} }),
  );
  for (const component of ["page", "card", "button", "values"])
    assert.ok(markup.includes(`data-host="${component}"`));
  assert.ok(markup.includes("Mon profil"));
  assert.ok(markup.includes("Alice"));
  assert.doesNotMatch(markup, /<style|<iframe|<nav|style=|class=/u);
});
test("native identity screens hide unconfigured account actions and unavailable organizations", () => {
  const profile = renderToStaticMarkup(
    h(HankoIdentityView, { ...props, page: "profile" }),
  );
  assert.doesNotMatch(profile, /<button/u);
  const organizations = renderToStaticMarkup(
    h(HankoIdentityView, {
      ...props,
      page: "organizations",
      account: { ...account, organizationsAvailable: false },
    }),
  );
  assert.ok(organizations.includes('role="status"'));
  assert.doesNotMatch(organizations, /<form|<button/u);
  const security = renderToStaticMarkup(
    h(HankoIdentityView, { ...props, page: "security", onAccountAction() {} }),
  );
  assert.equal((security.match(/<button/gu) ?? []).length, 3);
  assert.ok(security.includes("Configurer un authentificateur"));
});
test("cached native screens reject an account from another session", () => {
  assert.throws(() =>
    renderToStaticMarkup(
      h(HankoIdentityView, { ...props, subject: "bob", page: "profile" }),
    ),
  );
});
