"use client";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ComponentType,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import {
  validateHankoAccount,
  validateHankoOrganization,
  type HankoAccountSummary,
  type HankoIdentityController,
  type HankoOrganizationField,
  type HankoOrganizationDetails,
} from "./identity.js";

export type HankoAccountAction =
  "profile" | "password" | "email" | "otp" | "logout";
export type HankoIdentityPage =
  "profile" | "organizations" | "access" | "security";
type Children = { children: ReactNode };
export interface HankoIdentitySelectProps {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  disabled?: boolean;
}
/** Host-owned components. This contract carries no CSS, router or UI-library dependency. */
export interface HankoIdentityUI {
  Page: ComponentType<Children & { title: string; description?: string }>;
  Section: ComponentType<Children & { title?: string }>;
  Group: ComponentType<Children & { inline?: boolean }>;
  Field: ComponentType<Children & { label: string; htmlFor: string }>;
  Input: ComponentType<InputHTMLAttributes<HTMLInputElement>>;
  Textarea: ComponentType<TextareaHTMLAttributes<HTMLTextAreaElement>>;
  Select: ComponentType<HankoIdentitySelectProps>;
  Button: ComponentType<
    ButtonHTMLAttributes<HTMLButtonElement> & {
      tone?: "primary" | "secondary" | "danger";
    }
  >;
  Status: ComponentType<
    Children & {
      kind: "loading" | "error" | "success" | "empty";
      role: "status" | "alert";
    }
  >;
  Values: ComponentType<{ items: readonly { label: string; value: string }[] }>;
  Members: ComponentType<{
    members: HankoOrganizationDetails["members"];
    labels: { name: string; email: string; role: string; actions: string };
    renderActions?: (
      member: HankoOrganizationDetails["members"][number],
    ) => ReactNode;
  }>;
}
export interface HankoIdentityScreenProps {
  subject: string;
  controller: HankoIdentityController;
  page: HankoIdentityPage;
  ui: HankoIdentityUI;
  locale?: "en" | "fr";
  title?: string;
  description?: string;
  onAccountAction?: (action: HankoAccountAction) => void | Promise<void>;
}
export const hankoIdentityMessages = {
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
    actions: "Actions",
    noMembers: "No member yet.",
    details: "Organization details",
    readOnly: "You have read-only access to this organization.",
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
    actions: "Actions",
    noMembers: "Aucun membre pour le moment.",
    details: "Informations de l’organisation",
    readOnly: "Vous disposez d’un accès en lecture seule à cette organisation.",
  },
};
export type HankoIdentityMessages = typeof hankoIdentityMessages.en;

/** Loading is bound to both the authenticated subject and the controller. Stale results never render. */
export function useHankoAccount(
  subject: string,
  controller: HankoIdentityController,
) {
  const [revision, setRevision] = useState(0);
  const key = useMemo(() => ({ subject, controller }), [subject, controller]);
  const [result, setResult] = useState<{
    key: typeof key;
    data?: HankoAccountSummary;
    error: boolean;
  }>();
  useEffect(() => {
    const cancellation = new AbortController();
    controller
      .account(cancellation.signal)
      .then((data) => {
        validateHankoAccount(data, subject);
        if (!cancellation.signal.aborted)
          setResult({ key, data, error: false });
      })
      .catch(() => {
        if (!cancellation.signal.aborted) setResult({ key, error: true });
      });
    return () => cancellation.abort();
  }, [key, subject, controller, revision]);
  return {
    data: result?.key === key ? result.data : undefined,
    error: result?.key === key && result.error,
    reload: () => setRevision((value) => value + 1),
  };
}
export function useHankoOrganization(
  id: string,
  controller: HankoIdentityController,
) {
  const [revision, setRevision] = useState(0);
  const key = useMemo(() => ({ id, controller }), [id, controller]);
  const [result, setResult] = useState<{
    key: typeof key;
    data?: HankoOrganizationDetails;
    error: boolean;
  }>();
  useEffect(() => {
    const cancellation = new AbortController();
    controller
      .organization(id, cancellation.signal)
      .then((data) => {
        validateHankoOrganization(data, id);
        if (!cancellation.signal.aborted)
          setResult({ key, data, error: false });
      })
      .catch(() => {
        if (!cancellation.signal.aborted) setResult({ key, error: true });
      });
    return () => cancellation.abort();
  }, [key, id, controller, revision]);
  return {
    data: result?.key === key ? result.data : undefined,
    error: result?.key === key && result.error,
    reload: () => setRevision((value) => value + 1),
  };
}
export function useHankoIdentityMutation() {
  const active = useRef<AbortController | undefined>(undefined);
  const [state, setState] = useState<"idle" | "pending" | "error" | "saved">(
    "idle",
  );
  useEffect(() => () => active.current?.abort(), []);
  async function run(task: (signal: AbortSignal) => void | Promise<void>) {
    if (active.current) return false;
    const cancellation = new AbortController();
    active.current = cancellation;
    setState("pending");
    try {
      await task(
        AbortSignal.any([cancellation.signal, AbortSignal.timeout(10000)]),
      );
      if (!cancellation.signal.aborted) setState("saved");
      return !cancellation.signal.aborted;
    } catch {
      if (!cancellation.signal.aborted) setState("error");
      return false;
    } finally {
      if (active.current === cancellation) active.current = undefined;
    }
  }
  return { state, busy: state === "pending", run };
}

/** A native application screen: the host supplies every visual component and owns navigation. */
export function HankoIdentityScreen(props: Readonly<HankoIdentityScreenProps>) {
  return <IdentityScreen key={props.subject} {...props} />;
}
function IdentityScreen(props: Readonly<HankoIdentityScreenProps>) {
  const account = useHankoAccount(props.subject, props.controller);
  const t = hankoIdentityMessages[props.locale ?? "en"];
  if (!account.data)
    return (
      <LoadState
        ui={props.ui}
        t={t}
        error={account.error}
        retry={account.reload}
      />
    );
  return (
    <HankoIdentityView
      {...props}
      account={account.data}
      reload={account.reload}
    />
  );
}
export interface HankoIdentityViewProps extends HankoIdentityScreenProps {
  account: HankoAccountSummary;
  reload: () => void;
}
/** Already-loaded variant for hosts which manage their account query/cache. */
export function HankoIdentityView(props: Readonly<HankoIdentityViewProps>) {
  validateHankoAccount(props.account, props.subject);
  const { ui, page, title, description, account } = props;
  const t = hankoIdentityMessages[props.locale ?? "en"];
  return (
    <ui.Page title={title || t[page]} {...(description ? { description } : {})}>
      {page === "profile" && (
        <ui.Section>
          <ui.Values
            items={[
              { label: t.name, value: account.name },
              { label: t.email, value: account.email },
            ]}
          />
          {props.onAccountAction && (
            <AccountAction {...props} label={t.edit} action="profile" />
          )}
        </ui.Section>
      )}
      {page === "security" && (
        <ui.Section>
          <ui.Group inline>
            {props.onAccountAction &&
              (["password", "otp", "logout"] as const).map((action) => (
                <AccountAction
                  key={action}
                  {...props}
                  label={t[action]}
                  action={action}
                />
              ))}
          </ui.Group>
        </ui.Section>
      )}
      {page === "access" && (
        <ui.Section>
          <ui.Values
            items={
              account.roles.length
                ? account.roles.map((role) => ({ label: t.role, value: role }))
                : [{ label: t.role, value: t.noRoles }]
            }
          />
          {!!account.resources?.length && (
            <ui.Section title={t.resources}>
              <ui.Values
                items={account.resources.map((resource) => ({
                  label: resource.name,
                  value: resource.scopes.join(", "),
                }))}
              />
            </ui.Section>
          )}
        </ui.Section>
      )}
      {page === "organizations" &&
        (account.organizationsAvailable === false ? (
          <ui.Status kind="empty" role="status">
            {t.unavailable}
          </ui.Status>
        ) : (
          <Organizations key={props.subject} {...props} />
        ))}
    </ui.Page>
  );
}
function LoadState({
  ui,
  t,
  error,
  retry,
}: {
  ui: HankoIdentityUI;
  t: HankoIdentityMessages;
  error: boolean;
  retry: () => void;
}) {
  return (
    <ui.Status
      kind={error ? "error" : "loading"}
      role={error ? "alert" : "status"}
    >
      {t[error ? "unavailable" : "loading"]}
      {error && (
        <ui.Button type="button" tone="secondary" onClick={retry}>
          {t.retry}
        </ui.Button>
      )}
    </ui.Status>
  );
}
function AccountAction({
  ui,
  locale = "en",
  onAccountAction,
  label,
  action,
}: HankoIdentityViewProps & { label: string; action: HankoAccountAction }) {
  const mutation = useHankoIdentityMutation();
  const t = hankoIdentityMessages[locale];
  return (
    <ui.Group>
      <ui.Button
        type="button"
        tone={action === "logout" ? "secondary" : "primary"}
        disabled={mutation.busy}
        onClick={() => {
          void mutation.run(() => onAccountAction?.(action));
        }}
      >
        {label}
      </ui.Button>
      {mutation.state === "error" && (
        <ui.Status kind="error" role="alert">
          {t.unavailable}
        </ui.Status>
      )}
    </ui.Group>
  );
}
function Organizations(props: HankoIdentityViewProps) {
  const { account, controller, ui, locale = "en" } = props;
  const t = hankoIdentityMessages[locale];
  const selector = useId();
  const [selection, select] = useState(account.organizations[0]?.id ?? "");
  const selected = account.organizations.some((org) => org.id === selection)
    ? selection
    : (account.organizations[0]?.id ?? "");
  const [creating, setCreating] = useState(false);
  return (
    <ui.Group>
      {account.organizations.length > 1 && (
        <ui.Field label={t.organizations} htmlFor={selector}>
          <ui.Select
            id={selector}
            value={selected}
            onValueChange={select}
            options={account.organizations.map((org) => ({
              value: org.id,
              label: org.name,
            }))}
          />
        </ui.Field>
      )}
      {selected ? (
        <Organization key={selected} id={selected} {...props} />
      ) : (
        <ui.Status kind="empty" role="status">
          {t.empty}
        </ui.Status>
      )}
      {account.canCreateOrganization && controller.createOrganization && (
        <ui.Section>
          <ui.Button
            type="button"
            tone="secondary"
            aria-expanded={creating}
            onClick={() => setCreating((value) => !value)}
          >
            {creating ? t.cancel : t.create}
          </ui.Button>
          {creating && (
            <MutationForm
              ui={ui}
              t={t}
              label={t.create}
              fields={[
                { name: "name", label: t.name, maxLength: 100 },
                {
                  name: "slug",
                  label: t.slug,
                  maxLength: 63,
                  pattern: "[a-z0-9][a-z0-9-]{1,61}[a-z0-9]",
                },
              ]}
              submit={async (values, signal) => {
                await controller.createOrganization!(
                  { name: values.name ?? "", slug: values.slug ?? "" },
                  signal,
                );
                props.reload();
              }}
            />
          )}
        </ui.Section>
      )}
    </ui.Group>
  );
}
function Organization(props: HankoIdentityViewProps & { id: string }) {
  const { id, controller, ui, locale = "en" } = props;
  const t = hankoIdentityMessages[locale];
  const result = useHankoOrganization(id, controller);
  if (!result.data)
    return (
      <LoadState ui={ui} t={t} error={result.error} retry={result.reload} />
    );
  const details = result.data;
  const fields: Field[] = [
    {
      name: "name",
      label: t.name,
      value: details.organization.name,
      maxLength: 100,
    },
    {
      name: "description",
      label: t.description,
      value: details.organization.description ?? "",
      optional: true,
      maxLength: 2000,
      multiline: true,
    },
    {
      name: "website",
      label: t.website,
      value: details.organization.website ?? "",
      optional: true,
      maxLength: 320,
    },
    {
      name: "email",
      label: t.email,
      value: details.organization.email ?? "",
      optional: true,
      maxLength: 320,
    },
  ];
  const editable = fields.filter(
    (field) =>
      !details.editableFields ||
      details.editableFields.includes(field.name as HankoOrganizationField),
  );
  return (
    <ui.Group>
      <ui.Section title={details.organization.name}>
        {details.permissions.edit &&
        controller.updateOrganization &&
        editable.length > 0 ? (
          <MutationForm
            ui={ui}
            t={t}
            fields={editable}
            submit={async (values, signal) => {
              await controller.updateOrganization!(
                id,
                { ...values, name: values.name ?? details.organization.name },
                signal,
              );
              // Update both the organization and the account's organization labels.
              result.reload();
              props.reload();
            }}
          />
        ) : (
          <>
            <ui.Values
              items={fields
                .filter((field) => !!field.value)
                .map((field) => ({ label: field.label, value: field.value! }))}
            />
            <ui.Status kind="empty" role="status">
              {t.readOnly}
            </ui.Status>
          </>
        )}
      </ui.Section>
      {details.membersAvailable !== false && (
        <ui.Section title={t.members}>
          {details.members.length ? (
            <ui.Members
              members={details.members}
              labels={{
                name: t.name,
                email: t.email,
                role: t.role,
                actions: t.actions,
              }}
              {...(details.permissions.manageMembers &&
              (controller.changeMemberRole || controller.removeMember)
                ? {
                    renderActions: (
                      member: HankoOrganizationDetails["members"][number],
                    ) => (
                      <MemberActions
                        {...props}
                        details={details}
                        member={member}
                        refresh={result.reload}
                      />
                    ),
                  }
                : {})}
            />
          ) : (
            <ui.Status kind="empty" role="status">
              {t.noMembers}
            </ui.Status>
          )}
        </ui.Section>
      )}
      {details.permissions.invite &&
        controller.inviteMember &&
        details.roles.length > 0 && (
          <ui.Section title={t.invite}>
            <MutationForm
              ui={ui}
              t={t}
              label={t.invite}
              fields={[{ name: "email", label: t.email, maxLength: 320 }]}
              roles={details.roles}
              submit={async (values, signal) => {
                await controller.inviteMember!(
                  id,
                  { email: values.email ?? "", role: values.role ?? "" },
                  signal,
                );
                result.reload();
              }}
            />
          </ui.Section>
        )}
    </ui.Group>
  );
}
function MemberActions({
  details,
  member,
  refresh,
  controller,
  ui,
  locale = "en",
}: HankoIdentityViewProps & {
  details: HankoOrganizationDetails;
  member: HankoOrganizationDetails["members"][number];
  refresh: () => void;
}) {
  const t = hankoIdentityMessages[locale];
  const [confirm, setConfirm] = useState(false);
  const mutation = useHankoIdentityMutation();
  return (
    <ui.Group inline>
      {controller.changeMemberRole && details.roles.length > 0 && (
        <MutationForm
          ui={ui}
          t={t}
          fields={[]}
          roles={details.roles}
          role={member.role}
          submit={async (values, signal) => {
            await controller.changeMemberRole!(
              details.organization.id,
              member.id,
              values.role ?? "",
              signal,
            );
            refresh();
          }}
        />
      )}
      {controller.removeMember &&
        (confirm ? (
          <>
            <ui.Button
              type="button"
              tone="danger"
              disabled={mutation.busy}
              onClick={() => {
                void mutation.run(async (signal) => {
                  await controller.removeMember!(
                    details.organization.id,
                    member.id,
                    signal,
                  );
                  refresh();
                });
              }}
            >
              {t.confirm}
            </ui.Button>
            <ui.Button
              type="button"
              tone="secondary"
              disabled={mutation.busy}
              onClick={() => setConfirm(false)}
            >
              {t.cancel}
            </ui.Button>
          </>
        ) : (
          <ui.Button
            type="button"
            tone="secondary"
            onClick={() => setConfirm(true)}
          >
            {t.remove}
          </ui.Button>
        ))}
      {mutation.state === "error" && (
        <ui.Status kind="error" role="alert">
          {t.unavailable}
        </ui.Status>
      )}
    </ui.Group>
  );
}
interface Field {
  name: string;
  label: string;
  value?: string;
  optional?: boolean;
  multiline?: boolean;
  maxLength: number;
  pattern?: string;
}
function MutationForm({
  ui,
  t,
  fields,
  roles,
  role,
  label,
  submit,
}: {
  ui: HankoIdentityUI;
  t: HankoIdentityMessages;
  fields: readonly Field[];
  roles?: HankoOrganizationDetails["roles"];
  role?: string;
  label?: string;
  submit: (data: Record<string, string>, signal: AbortSignal) => Promise<void>;
}) {
  const id = useId();
  const [selectedRole, selectRole] = useState(role ?? roles?.[0]?.id ?? "");
  const mutation = useHankoIdentityMutation();
  return (
    <form
      aria-busy={mutation.busy}
      onSubmit={(event) => {
        event.preventDefault();
        const values = Object.fromEntries(
          new FormData(event.currentTarget),
        ) as Record<string, string>;
        void mutation.run((signal) => submit(values, signal));
      }}
    >
      <ui.Group>
        {fields.map((field) => {
          const props = {
            id: `${id}-${field.name}`,
            name: field.name,
            defaultValue: field.value ?? "",
            required: !field.optional,
            disabled: mutation.busy,
            maxLength: field.maxLength,
          };
          return (
            <ui.Field key={field.name} label={field.label} htmlFor={props.id}>
              {field.multiline ? (
                <ui.Textarea {...props} />
              ) : (
                <ui.Input
                  {...props}
                  type={
                    field.name === "email"
                      ? "email"
                      : field.name === "website"
                        ? "url"
                        : "text"
                  }
                  {...(field.pattern ? { pattern: field.pattern } : {})}
                />
              )}
            </ui.Field>
          );
        })}
        {roles && (
          <ui.Field label={t.role} htmlFor={`${id}-role`}>
            <ui.Select
              id={`${id}-role`}
              value={selectedRole}
              onValueChange={selectRole}
              options={roles.map((role) => ({
                value: role.id,
                label: role.name,
              }))}
              disabled={mutation.busy}
            />
            <input type="hidden" name="role" value={selectedRole} />
          </ui.Field>
        )}
        <ui.Button type="submit" disabled={mutation.busy}>
          {label ?? t.save}
        </ui.Button>
        {(mutation.state === "error" || mutation.state === "saved") && (
          <ui.Status
            kind={mutation.state === "error" ? "error" : "success"}
            role={mutation.state === "error" ? "alert" : "status"}
          >
            {t[mutation.state === "error" ? "unavailable" : "saved"]}
          </ui.Status>
        )}
      </ui.Group>
    </form>
  );
}
