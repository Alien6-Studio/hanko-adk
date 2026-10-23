"use client";
import { useEffect, useState } from "react";
import {
  ExperienceShell,
  useTheme,
  type ExperienceContext,
} from "@alien6/hankoshell-keycloak-theme-builder/experience/react";
import { ThemeProvider } from "@alien6/hankoshell-keycloak-theme-builder/react";
import type {
  ThemeConfig,
  ColorMode,
} from "@alien6/hankoshell-keycloak-theme-builder";
import type {
  HankoAccountSummary,
  HankoIdentityController,
} from "./identity.js";
import {
  HankoIdentityView,
  hankoIdentityMessages,
  useHankoAccount,
  type HankoAccountAction,
  type HankoIdentityPage as IdentityPage,
  type HankoIdentityUI,
} from "./identity-react.js";
export type { HankoAccountAction, HankoIdentityUI } from "./identity-react.js";

export interface HankoIdentityPortalProps {
  subject: string;
  controller: HankoIdentityController;
  theme: ThemeConfig;
  locale?: "en" | "fr";
  mode?: ColorMode;
  page?: IdentityPage;
  onAccountAction?: (action: HankoAccountAction) => void | Promise<void>;
}
/** Host-routed screen. Supply the application's components through `ui` for native design-system integration. */
export interface HankoIdentityPageProps extends HankoIdentityPortalProps {
  page: IdentityPage;
  ui?: HankoIdentityUI;
}
interface PortalContext extends ExperienceContext {
  account: HankoAccountSummary;
  controller: HankoIdentityController;
  action?: (action: HankoAccountAction) => void | Promise<void>;
  reload: () => void;
  ui: HankoIdentityUI;
}
/** Standalone themed portal. Native applications should use HankoIdentityPage with their own UI adapter. */
export function HankoIdentityPortal(props: Readonly<HankoIdentityPortalProps>) {
  return <IdentityPortal key={props.subject} {...props} />;
}
export function HankoIdentityPage(props: Readonly<HankoIdentityPageProps>) {
  return <IdentityPortal key={props.subject} {...props} presentation="page" />;
}
function IdentityPortal({
  subject,
  controller,
  theme,
  locale = "en",
  mode,
  page,
  onAccountAction,
  ui = legacyUI,
  presentation = "portal",
}: Readonly<
  HankoIdentityPortalProps & {
    presentation?: "portal" | "page";
    ui?: HankoIdentityUI;
  }
>) {
  const [activePage, setActivePage] = useState(page);
  useEffect(() => setActivePage(page), [page]);
  const [hostMode, setHostMode] = useState<ColorMode>("light");
  useEffect(() => {
    if (mode) return;
    const update = () =>
      setHostMode(
        document.documentElement.classList.contains("dark") ? "dark" : "light",
      );
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, [mode]);
  const account = useHankoAccount(subject, controller);
  const t = hankoIdentityMessages[locale];
  if (!account.data)
    return (
      <ui.Status
        kind={account.error ? "error" : "loading"}
        role={account.error ? "alert" : "status"}
      >
        {t[account.error ? "unavailable" : "loading"]}
        {account.error && (
          <ui.Button type="button" tone="secondary" onClick={account.reload}>
            {t.retry}
          </ui.Button>
        )}
      </ui.Status>
    );
  const available = modules.filter(
    (module) =>
      module.id !== "organizations" ||
      account.data?.organizationsAvailable !== false,
  );
  const context: PortalContext = {
    subject,
    locale,
    capabilities: [],
    account: account.data,
    controller,
    ui,
    ...(onAccountAction ? { action: onAccountAction } : {}),
    reload: account.reload,
  };
  if (presentation === "page") {
    const current = available.find((module) => module.id === page);
    return (
      <ThemeProvider config={theme} mode={mode ?? hostMode}>
        {current ? (
          <current.Component context={context} />
        ) : (
          <ui.Status kind="empty" role="status">
            {t.unavailable}
          </ui.Status>
        )}
      </ThemeProvider>
    );
  }
  return (
    <div className="hk-account">
      <style>{`.hk-account .hk-row{flex-wrap:wrap;justify-content:flex-start;gap:.75rem}.hk-account .hk-container{min-width:0}.hk-account .hk-card{overflow-wrap:anywhere}.hk-account .hk-group{display:grid;gap:1rem}.hk-account nav{padding-bottom:1rem;margin-bottom:1rem;border-bottom:1px solid var(--border)}.hk-account nav .hk-link{border:0;background:transparent;padding:.5rem .75rem;border-radius:var(--control-radius);color:var(--fg-muted);font:inherit;font-size:.875rem;cursor:pointer}.hk-account nav .hk-link[aria-current=page]{color:var(--primary);background:color-mix(in srgb,var(--primary) 12%,transparent);font-weight:600}.hk-account dl{margin-block:1rem}.hk-account dd{margin:0 0 1rem}.hk-account h2{font-size:1rem;margin-block:1.5rem .75rem}`}</style>
      <ExperienceShell
        embedded
        theme={{ ...theme, layout: { contentWidth: "960px", ...theme.layout } }}
        mode={mode ?? hostMode}
        {...(activePage ? { page: activePage } : {})}
        onNavigate={(value) => setActivePage(value as IdentityPage)}
        manifest={{
          contract: "hanko.experience/v1",
          id: "hanko-account",
          version: "1.0.0",
          surfaces: available.map((module) => ({
            id: module.id,
            kind: "self-service" as const,
            capabilities: [],
          })),
        }}
        modules={available}
        context={context}
      />
    </div>
  );
}
function ThemedPage({
  context,
  page,
}: {
  context: PortalContext;
  page: IdentityPage;
}) {
  const { config } = useTheme();
  const settings = config.modules?.[`account.${page}`];
  const text = (value: unknown, max: number) => {
    const localized =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)[context.locale]
        : value;
    return typeof localized === "string" && localized.length <= max
      ? localized
      : undefined;
  };
  const title = text(settings?.title, 256);
  const description = text(settings?.description, 512);
  return (
    <HankoIdentityView
      subject={context.subject}
      controller={context.controller}
      account={context.account}
      reload={context.reload}
      ui={context.ui}
      locale={context.locale}
      page={page}
      {...(context.action ? { onAccountAction: context.action } : {})}
      {...(title ? { title } : {})}
      {...(description ? { description } : {})}
    />
  );
}
const modules = (
  ["profile", "organizations", "access", "security"] as const
).map((page) => ({
  id: page,
  title: {
    en: hankoIdentityMessages.en[page],
    fr: hankoIdentityMessages.fr[page],
  },
  Component: function AccountPage({ context }: { context: PortalContext }) {
    return <ThemedPage context={context} page={page} />;
  },
}));

/** Compatibility renderer for standalone Theme Builder portals. Native screens supply host components. */
const legacyUI: HankoIdentityUI = {
  Page: ({ title, description, children }) => (
    <section>
      <h1 className="hk-header">{title}</h1>
      {description && <p className="hk-help">{description}</p>}
      {children}
    </section>
  ),
  Section: ({ title, children }) => (
    <section>
      {title && <h2>{title}</h2>}
      {children}
    </section>
  ),
  Group: ({ inline, children }) => (
    <div className={inline ? "hk-row" : "hk-group"}>{children}</div>
  ),
  Field: ({ label, htmlFor, children }) => (
    <div className="hk-field">
      <label className="hk-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  ),
  Input: (props) => <input {...props} className="hk-input" />,
  Textarea: (props) => <textarea {...props} className="hk-input" />,
  Select: ({ id, value, onValueChange, options, disabled }) => (
    <select
      id={id}
      className="hk-input"
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      disabled={disabled}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
  Button: ({ tone = "primary", ...props }) => (
    <button
      {...props}
      className={tone === "secondary" ? "hk-link" : "hk-btn hk-btn-primary"}
    />
  ),
  Status: ({ children, role }) => <div role={role}>{children}</div>,
  Values: ({ items }) => (
    <dl>
      {items.map((item, index) => (
        <div key={index}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  ),
  Members: ({ members, renderActions }) => (
    <ul style={{ padding: 0, listStyle: "none" }}>
      {members.map((member) => (
        <li key={member.id} style={{ marginBlock: "1rem" }}>
          <strong>{member.name}</strong>
          {member.email && <span> · {member.email}</span>}
          <span> · {member.role}</span>
          {renderActions?.(member)}
        </li>
      ))}
    </ul>
  ),
};
