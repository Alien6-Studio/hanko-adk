import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  HankoIdentityView,
  hankoIdentityMessages,
  hankoIdentityLocales,
  resolveHankoIdentityLocale,
  hankoIdentityDirection,
  type HankoIdentityUI,
} from "./identity-react.js";
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
test("identity screens have complete messages for every supported locale", () => {
  const keys = Object.keys(hankoIdentityMessages.en).sort();
  for (const locale of hankoIdentityLocales) {
    assert.deepEqual(Object.keys(hankoIdentityMessages[locale]).sort(), keys);
    assert.ok(
      Object.values(hankoIdentityMessages[locale]).every((value) =>
        value.trim(),
      ),
    );
    const profile = renderToStaticMarkup(
      h(HankoIdentityView, { ...props, page: "profile", locale }),
    );
    assert.ok(profile.includes(hankoIdentityMessages[locale].profile));
    assert.ok(profile.includes("Alice"));
    const security = renderToStaticMarkup(
      h(HankoIdentityView, {
        ...props,
        page: "security",
        locale,
        onAccountAction() {},
      }),
    );
    assert.ok(security.includes(hankoIdentityMessages[locale].password));
    assert.equal((security.match(/<button/gu) ?? []).length, 3);
  }
});
test("regional language tags and RTL languages have deterministic fallbacks", () => {
  for (const [input, expected] of [
    ["fr-CA", "fr"],
    ["de-DE", "de"],
    ["pt", "pt-BR"],
    ["he-IL", "he"],
    ["iw", "he"],
    ["ar-SA", "ar"],
    ["unknown", "en"],
    ["not_a_locale", "en"],
  ]) {
    assert.equal(resolveHankoIdentityLocale(input), expected);
  }
  assert.equal(hankoIdentityDirection("he-IL"), "rtl");
  assert.equal(hankoIdentityDirection("ar"), "rtl");
  assert.equal(hankoIdentityDirection("en"), "ltr");
  assert.doesNotThrow(() =>
    renderToStaticMarkup(
      h(HankoIdentityView, { ...props, page: "profile", locale: "unknown" }),
    ),
  );
});
