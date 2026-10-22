"use client";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ExperienceShell,
  useTheme,
  type ExperienceContext,
} from "@alien6/hankoshell-keycloak-theme-builder/experience/react";
import type {
  ThemeConfig,
  ColorMode,
} from "@alien6/hankoshell-keycloak-theme-builder";
import {
  validateHankoAccount,
  validateHankoOrganization,
  type HankoAccountSummary,
  type HankoIdentityController,
  type HankoOrganizationDetails,
} from "./identity.js";

export type HankoAccountAction =
  "profile" | "password" | "email" | "otp" | "logout";
export interface HankoIdentityPortalProps {
  subject: string;
  controller: HankoIdentityController;
  theme: ThemeConfig;
  locale?: "en" | "fr";
  mode?: ColorMode;
  page?: "profile" | "organizations" | "access" | "security";
  onAccountAction?: (action: HankoAccountAction) => void | Promise<void>;
}
const words = {
  en: {
    profile: "My profile",
    organizations: "Organizations",
    access: "My access",
    security: "Security",
    loading: "Loading…",
    retry: "Try again",
    unavailable: "This information is unavailable.",
    empty: "No organization is available for your account.",
    name: "Name",
    email: "Email",
    role: "Role",
    members: "Members",
    save: "Save",
    saved: "Saved.",
    cancel: "Cancel",
    remove: "Remove",
    confirm: "Confirm removal",
    create: "Create organization",
    slug: "Identifier",
    description: "Description",
    website: "Website",
    invite: "Invite",
    edit: "Edit my information",
    password: "Change password",
    otp: "Set up an authenticator",
    logout: "Sign out",
    noRoles: "No role is assigned.",
    resources: "Resources",
  },
  fr: {
    profile: "Mon profil",
    organizations: "Organisations",
    access: "Mes accès",
    security: "Sécurité",
    loading: "Chargement…",
    retry: "Réessayer",
    unavailable: "Ces informations sont indisponibles.",
    empty: "Aucune organisation n’est disponible pour votre compte.",
    name: "Nom",
    email: "Email",
    role: "Rôle",
    members: "Membres",
    save: "Enregistrer",
    saved: "Enregistré.",
    cancel: "Annuler",
    remove: "Retirer",
    confirm: "Confirmer le retrait",
    create: "Créer une organisation",
    slug: "Identifiant",
    description: "Description",
    website: "Site web",
    invite: "Inviter",
    edit: "Modifier mes informations",
    password: "Changer le mot de passe",
    otp: "Configurer un authentificateur",
    logout: "Se déconnecter",
    noRoles: "Aucun rôle attribué.",
    resources: "Ressources",
  },
};
type Copy = typeof words.en;
interface PortalContext extends ExperienceContext {
  account: HankoAccountSummary;
  controller: HankoIdentityController;
  action?: (action: HankoAccountAction) => void | Promise<void>;
  reload: () => void;
}

/** App-owned sessions and backend authorization; shared screens and branding. */
export function HankoIdentityPortal(props: Readonly<HankoIdentityPortalProps>) {
  return <IdentityPortal key={props.subject} {...props} />;
}
function IdentityPortal({
  subject,
  controller,
  theme,
  locale = "en",
  mode,
  page,
  onAccountAction,
}: Readonly<HankoIdentityPortalProps>) {
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
  const [account, setAccount] = useState<HankoAccountSummary>();
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const cancellation = new AbortController();
    setAccount(undefined);
    setError(false);
    controller
      .account(cancellation.signal)
      .then((account) => {
        validateHankoAccount(account, subject);
        if (!cancellation.signal.aborted) setAccount(account);
      })
      .catch(() => {
        if (!cancellation.signal.aborted) setError(true);
      });
    return () => cancellation.abort();
  }, [controller, subject, revision]);
  const modules = useMemo(
    () => [
      {
        id: "profile",
        title: { en: words.en.profile, fr: words.fr.profile },
        Component: Profile,
      },
      {
        id: "organizations",
        title: { en: words.en.organizations, fr: words.fr.organizations },
        Component: Organizations,
      },
      {
        id: "access",
        title: { en: words.en.access, fr: words.fr.access },
        Component: Access,
      },
      {
        id: "security",
        title: { en: words.en.security, fr: words.fr.security },
        Component: Security,
      },
    ],
    [],
  );
  if (!account)
    return (
      <p role={error ? "alert" : "status"}>
        {words[locale][error ? "unavailable" : "loading"]}{" "}
        {error && (
          <button
            type="button"
            onClick={() => setRevision((value) => value + 1)}
          >
            {words[locale].retry}
          </button>
        )}
      </p>
    );
  const availableModules = modules.filter(
    (module) =>
      module.id !== "organizations" || account.organizationsAvailable !== false,
  );
  return (
    <div className="hk-account">
      <style>{`.hk-account .hk-row{flex-wrap:wrap;justify-content:flex-start;row-gap:.75rem}.hk-account .hk-container{min-width:0}.hk-account .hk-card{overflow-wrap:anywhere}.hk-account nav{padding-bottom:1rem;margin-bottom:1rem;border-bottom:1px solid var(--border)}.hk-account nav .hk-link{border:0;background:transparent;padding:.5rem .75rem;border-radius:var(--control-radius);color:var(--fg-muted);font:inherit;font-size:.875rem;cursor:pointer}.hk-account nav .hk-link[aria-current=page]{color:var(--primary);background:color-mix(in srgb,var(--primary) 12%,transparent);font-weight:600}.hk-account dl{margin-block:1rem}.hk-account dd{margin:0 0 1rem}.hk-account h2{font-size:1rem;margin-block:1.5rem .75rem}`}</style>
      <ExperienceShell
        embedded
        theme={{ ...theme, layout: { contentWidth: "960px", ...theme.layout } }}
        mode={mode ?? hostMode}
        {...(activePage ? { page: activePage } : {})}
        onNavigate={(value) =>
          setActivePage(value as HankoIdentityPortalProps["page"])
        }
        manifest={{
          contract: "hanko.experience/v1",
          id: "hanko-account",
          version: "1.0.0",
          surfaces: availableModules.map((module) => ({
            id: module.id,
            kind: "self-service" as const,
            capabilities: [],
          })),
        }}
        modules={availableModules}
        context={{
          subject,
          locale,
          capabilities: [],
          account,
          controller,
          ...(onAccountAction ? { action: onAccountAction } : {}),
          reload: () => setRevision((value) => value + 1),
        }}
      />
    </div>
  );
}

function PageHeading({
  page,
  context,
}: {
  page: NonNullable<HankoIdentityPortalProps["page"]>;
  context: PortalContext;
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
  const title = text(settings?.title, 256) || words[context.locale][page];
  const description = text(settings?.description, 512);
  return (
    <>
      <h1 className="hk-header">{title}</h1>
      {description && <p className="hk-help">{description}</p>}
    </>
  );
}

function Profile({ context }: { context: PortalContext }) {
  const t = words[context.locale];
  return (
    <section>
      <PageHeading page="profile" context={context} />
      <dl>
        <dt>{t.name}</dt>
        <dd>{context.account.name}</dd>
        <dt>{t.email}</dt>
        <dd>{context.account.email}</dd>
      </dl>
      {context.action && (
        <Action label={t.edit} run={() => context.action!("profile")} t={t} />
      )}
    </section>
  );
}
function Security({ context }: { context: PortalContext }) {
  const t = words[context.locale];
  return (
    <section>
      <PageHeading page="security" context={context} />
      {context.action && (
        <div className="hk-row">
          {(["password", "otp", "logout"] as const).map((action) => (
            <Action
              key={action}
              label={t[action]}
              run={() => context.action!(action)}
              t={t}
            />
          ))}
        </div>
      )}
    </section>
  );
}
function Access({ context }: { context: PortalContext }) {
  const t = words[context.locale];
  return (
    <section>
      <PageHeading page="access" context={context} />
      {context.account.roles.length ? (
        <ul>
          {context.account.roles.map((role) => (
            <li key={role}>{role}</li>
          ))}
        </ul>
      ) : (
        <p>{t.noRoles}</p>
      )}
      {!!context.account.resources?.length && (
        <>
          <h2>{t.resources}</h2>
          <ul>
            {context.account.resources.map((resource) => (
              <li key={resource.id}>
                {resource.name}: {resource.scopes.join(", ")}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
function Action({
  label,
  run,
  t,
}: {
  label: string;
  run: () => void | Promise<void>;
  t: Copy;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return (
    <span>
      <button
        type="button"
        className="hk-btn hk-btn-primary"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setError(false);
          Promise.resolve()
            .then(run)
            .catch(() => setError(true))
            .finally(() => setBusy(false));
        }}
      >
        {label}
      </button>
      {error && <span role="alert">{t.unavailable}</span>}
    </span>
  );
}
function Organizations({ context }: { context: PortalContext }) {
  const t = words[context.locale];
  const [selected, setSelected] = useState(
    context.account.organizations[0]?.id ?? "",
  );
  const [creating, setCreating] = useState(false);
  return (
    <section>
      <PageHeading page="organizations" context={context} />
      {context.account.organizations.length > 0 ? (
        <>
          <label className="hk-label" htmlFor="hanko-organization">
            {t.organizations}
          </label>
          <select
            id="hanko-organization"
            className="hk-input"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
          >
            {context.account.organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
          {selected && (
            <Organization key={selected} id={selected} context={context} />
          )}
        </>
      ) : (
        <p>{t.empty}</p>
      )}
      {context.account.canCreateOrganization &&
        context.controller.createOrganization && (
          <>
            <button
              type="button"
              className="hk-link"
              onClick={() => setCreating((value) => !value)}
            >
              {t.create}
            </button>
            {creating && (
              <MutationForm
                t={t}
                fields={[
                  { name: "name", label: t.name },
                  { name: "slug", label: t.slug },
                ]}
                submit={async (data, signal) => {
                  await context.controller.createOrganization!(
                    { name: data.name ?? "", slug: data.slug ?? "" },
                    signal,
                  );
                  context.reload();
                }}
              />
            )}
          </>
        )}
    </section>
  );
}
function Organization({ id, context }: { id: string; context: PortalContext }) {
  const t = words[context.locale];
  const [details, setDetails] = useState<HankoOrganizationDetails>();
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const cancellation = new AbortController();
    setDetails(undefined);
    setError(false);
    context.controller
      .organization(id, cancellation.signal)
      .then((details) => {
        validateHankoOrganization(details, id);
        if (!cancellation.signal.aborted) setDetails(details);
      })
      .catch(() => {
        if (!cancellation.signal.aborted) setError(true);
      });
    return () => cancellation.abort();
  }, [context.controller, id, revision]);
  if (!details)
    return (
      <p role={error ? "alert" : "status"}>
        {t[error ? "unavailable" : "loading"]}{" "}
        {error && (
          <button
            type="button"
            className="hk-link"
            onClick={() => setRevision((value) => value + 1)}
          >
            {t.retry}
          </button>
        )}
      </p>
    );
  const refresh = () => setRevision((value) => value + 1);
  return (
    <div>
      <h2>{details.organization.name}</h2>
      {details.permissions.edit && context.controller.updateOrganization ? (
        <MutationForm
          t={t}
          fields={[
            { name: "name", label: t.name, value: details.organization.name },
            {
              name: "description",
              label: t.description,
              value: details.organization.description ?? "",
              optional: true,
            },
            {
              name: "website",
              label: t.website,
              value: details.organization.website ?? "",
              optional: true,
            },
            {
              name: "email",
              label: t.email,
              value: details.organization.email ?? "",
              optional: true,
            },
          ]}
          submit={async (data, signal) => {
            await context.controller.updateOrganization!(
              id,
              { ...data, name: data.name ?? "" },
              signal,
            );
            refresh();
          }}
        />
      ) : (
        <p>{details.organization.description}</p>
      )}
      {details.membersAvailable !== false && (
        <>
          <h2>{t.members}</h2>
          <ul style={{ padding: 0, listStyle: "none" }}>
            {details.members.map((member) => (
              <li key={member.id} style={{ marginBlock: "1rem" }}>
                <strong>{member.name}</strong>
                {member.email && <span> · {member.email}</span>}
                <span> · {member.role}</span>
                {details.permissions.manageMembers && (
                  <MemberActions
                    details={details}
                    member={member}
                    context={context}
                    refresh={refresh}
                  />
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {details.permissions.invite && context.controller.inviteMember && (
        <MutationForm
          t={t}
          label={t.invite}
          roles={details.roles}
          fields={[{ name: "email", label: t.email }]}
          submit={async (data, signal) => {
            await context.controller.inviteMember!(
              id,
              { email: data.email ?? "", role: data.role ?? "" },
              signal,
            );
            refresh();
          }}
        />
      )}
    </div>
  );
}
function MemberActions({
  details,
  member,
  context,
  refresh,
}: {
  details: HankoOrganizationDetails;
  member: HankoOrganizationDetails["members"][number];
  context: PortalContext;
  refresh: () => void;
}) {
  const t = words[context.locale];
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="hk-row">
      {context.controller.changeMemberRole && (
        <MutationForm
          t={t}
          roles={details.roles}
          role={member.role}
          fields={[]}
          submit={async (data, signal) => {
            await context.controller.changeMemberRole!(
              details.organization.id,
              member.id,
              data.role ?? "",
              signal,
            );
            refresh();
          }}
        />
      )}
      {context.controller.removeMember &&
        (confirm ? (
          <>
            <Action
              label={t.confirm}
              t={t}
              run={async () => {
                await context.controller.removeMember!(
                  details.organization.id,
                  member.id,
                  AbortSignal.timeout(10000),
                );
                refresh();
              }}
            />
            <button
              type="button"
              className="hk-link"
              onClick={() => setConfirm(false)}
            >
              {t.cancel}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="hk-link"
            onClick={() => setConfirm(true)}
          >
            {t.remove}
          </button>
        ))}
    </div>
  );
}
function MutationForm({
  t,
  fields,
  roles,
  role,
  label,
  submit,
}: {
  t: Copy;
  fields: readonly {
    name: string;
    label: string;
    value?: string;
    optional?: boolean;
  }[];
  roles?: HankoOrganizationDetails["roles"];
  role?: string;
  label?: string;
  submit: (data: Record<string, string>, signal: AbortSignal) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<"idle" | "error" | "saved">("idle");
  const active = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => active.current?.abort(), []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form)) as Record<
      string,
      string
    >;
    const cancellation = new AbortController();
    active.current = cancellation;
    setBusy(true);
    setState("idle");
    try {
      await submit(values, cancellation.signal);
      if (!cancellation.signal.aborted) setState("saved");
    } catch {
      if (!cancellation.signal.aborted) setState("error");
    } finally {
      if (!cancellation.signal.aborted) setBusy(false);
    }
  }
  return (
    <form onSubmit={save}>
      <fieldset disabled={busy} style={{ border: 0, padding: 0 }}>
        {fields.map((field) => (
          <label key={field.name} className="hk-field hk-label">
            {field.label}
            <input
              className="hk-input"
              name={field.name}
              type={field.name === "email" ? "email" : "text"}
              defaultValue={field.value ?? ""}
              required={!field.optional}
              maxLength={field.name === "description" ? 2000 : 320}
            />
          </label>
        ))}
        {roles && (
          <label className="hk-label">
            {t.role}
            <select
              name="role"
              className="hk-input"
              defaultValue={role ?? roles[0]?.id}
              required
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="submit" className="hk-btn hk-btn-primary">
          {label ?? t.save}
        </button>
      </fieldset>
      {state !== "idle" && (
        <p role={state === "error" ? "alert" : "status"}>
          {t[state === "error" ? "unavailable" : "saved"]}
        </p>
      )}
    </form>
  );
}
