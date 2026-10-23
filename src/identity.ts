import { requestHankoJson, type HankoFetch } from "./http.js";

export interface HankoAccountSummary {
  subject: string;
  name: string;
  email: string;
  roles: readonly string[];
  organizations: readonly HankoOrganizationSummary[];
  canCreateOrganization: boolean;
  /** Hide the module when the host has no authorized organization API. */
  organizationsAvailable?: boolean;
  resources?: readonly {
    id: string;
    name: string;
    scopes: readonly string[];
  }[];
}
export interface HankoOrganizationSummary {
  id: string;
  name: string;
  slug?: string;
  role?: string;
}
export type HankoOrganizationField =
  "name" | "description" | "website" | "email";
export interface HankoOrganizationDetails {
  organization: HankoOrganizationSummary & {
    description?: string;
    website?: string;
    email?: string;
  };
  members: readonly {
    id: string;
    name: string;
    email?: string;
    role: string;
  }[];
  roles: readonly { id: string; name: string }[];
  membersAvailable?: boolean;
  /** Omit fields which the application does not support. Defaults to all four fields. */
  editableFields?: readonly HankoOrganizationField[];
  permissions: { edit: boolean; invite: boolean; manageMembers: boolean };
}
export interface HankoOrganizationChanges {
  name: string;
  description?: string;
  website?: string;
  email?: string;
}

/** Implemented by an authenticated application backend, never a browser admin credential. */
export interface HankoIdentityController {
  account(signal: AbortSignal): Promise<HankoAccountSummary>;
  organization(
    id: string,
    signal: AbortSignal,
  ): Promise<HankoOrganizationDetails>;
  createOrganization?(
    input: { name: string; slug: string },
    signal: AbortSignal,
  ): Promise<void>;
  updateOrganization?(
    id: string,
    input: HankoOrganizationChanges,
    signal: AbortSignal,
  ): Promise<void>;
  inviteMember?(
    id: string,
    input: { email: string; role: string },
    signal: AbortSignal,
  ): Promise<void>;
  changeMemberRole?(
    id: string,
    memberId: string,
    role: string,
    signal: AbortSignal,
  ): Promise<void>;
  removeMember?(
    id: string,
    memberId: string,
    signal: AbortSignal,
  ): Promise<void>;
}

/** Same-origin session transport. The application's BFF authenticates every request. */
export function createHankoIdentityClient(options: {
  endpoint: string;
  fetch?: HankoFetch;
}): HankoIdentityController {
  if (!/^\/(?!\/)[^\s\\?#]*$/u.test(options.endpoint))
    throw new Error("Identity endpoint must be a same-origin path");
  const endpoint = options.endpoint;
  async function read<T>(url: string, signal: AbortSignal): Promise<T> {
    return requestHankoJson(
      url,
      { credentials: "same-origin", cache: "no-store", signal },
      options,
    );
  }
  async function write(
    action: string,
    input: object,
    signal: AbortSignal,
  ): Promise<void> {
    await requestHankoJson(
      endpoint,
      {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...input }),
      },
      options,
      [204],
    );
  }
  return {
    account: (signal) => read(endpoint, signal),
    organization: (id, signal) =>
      read(`${endpoint}?organization=${encodeURIComponent(id)}`, signal),
    createOrganization: (input, signal) =>
      write("createOrganization", { input }, signal),
    updateOrganization: (organization, input, signal) =>
      write("updateOrganization", { organization, input }, signal),
    inviteMember: (organization, input, signal) =>
      write("inviteMember", { organization, input }, signal),
    changeMemberRole: (organization, member, role, signal) =>
      write("changeMemberRole", { organization, member, role }, signal),
    removeMember: (organization, member, signal) =>
      write("removeMember", { organization, member }, signal),
  };
}

export function validateHankoAccount(
  account: HankoAccountSummary,
  subject: string,
): void {
  if (
    !subject ||
    account?.subject !== subject ||
    !Array.isArray(account.organizations) ||
    account.organizations.length > 128 ||
    !Array.isArray(account.roles) ||
    account.roles.length > 128 ||
    typeof account.canCreateOrganization !== "boolean"
  )
    throw new Error("Invalid account context");
  if (
    account.organizationsAvailable !== undefined &&
    typeof account.organizationsAvailable !== "boolean"
  )
    throw new Error("Invalid organization availability");
  bounded(account.name, 256);
  bounded(account.email, 320);
  const ids = new Set<string>();
  for (const organization of account.organizations) {
    identifier(organization.id);
    bounded(organization.name, 256);
    if (ids.has(organization.id)) throw new Error("Duplicate organization");
    ids.add(organization.id);
  }
  account.roles.forEach((role) => bounded(role, 255));
  if (account.resources !== undefined) {
    if (!Array.isArray(account.resources) || account.resources.length > 500)
      throw new Error("Invalid resource list");
    for (const resource of account.resources) {
      identifier(resource.id);
      bounded(resource.name, 256);
      if (!Array.isArray(resource.scopes) || resource.scopes.length > 128)
        throw new Error("Invalid resource scopes");
      resource.scopes.forEach((scope: unknown) => bounded(scope, 255));
    }
  }
}
export function validateHankoOrganization(
  details: HankoOrganizationDetails,
  id: string,
): void {
  if (
    details?.organization?.id !== id ||
    !Array.isArray(details.members) ||
    details.members.length > 1000 ||
    !Array.isArray(details.roles) ||
    details.roles.length > 128 ||
    !details.permissions ||
    [
      details.permissions.edit,
      details.permissions.invite,
      details.permissions.manageMembers,
    ].some((value) => typeof value !== "boolean")
  )
    throw new Error("Invalid organization context");
  if (
    details.membersAvailable !== undefined &&
    typeof details.membersAvailable !== "boolean"
  )
    throw new Error("Invalid member availability");
  if (
    details.editableFields !== undefined &&
    (!Array.isArray(details.editableFields) ||
      details.editableFields.length > 4 ||
      new Set(details.editableFields).size !== details.editableFields.length ||
      details.editableFields.some(
        (field: unknown) =>
          !["name", "description", "website", "email"].includes(
            field as string,
          ),
      ))
  )
    throw new Error("Invalid editable organization fields");
  bounded(details.organization.name, 256);
  if (details.organization.description !== undefined)
    bounded(details.organization.description, 2000, true);
  for (const field of ["website", "email"] as const)
    if (details.organization[field] !== undefined)
      bounded(details.organization[field], 320);
  const ids = new Set<string>();
  for (const member of details.members) {
    identifier(member.id);
    bounded(member.name, 256);
    bounded(member.role, 255);
    if (member.email !== undefined) bounded(member.email, 320);
    if (ids.has(member.id)) throw new Error("Duplicate member");
    ids.add(member.id);
  }
  for (const role of details.roles) {
    identifier(role.id);
    bounded(role.name, 255);
  }
}
export function identifier(value: unknown): asserts value is string {
  bounded(value, 255);
  if (!value || value === "." || value === ".." || /[/\\%?#]/u.test(value))
    throw new Error("Invalid identity identifier");
}
export function bounded(
  value: unknown,
  limit: number,
  multiline = false,
): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length > limit ||
    (multiline
      ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u
      : /[\u0000-\u001f\u007f]/u
    ).test(value)
  )
    throw new Error("Invalid identity field");
}
