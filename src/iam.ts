import { HankoOrganizationClient, pathSegment, realmPath } from "./organization.js";
import type { HankoOrganizationDelegation, HankoOrganizationDelegationSpec, HankoOrganizationDelegationMetadata } from "./organization-administration.js";

export interface HankoUser {
  readonly id: string;
  readonly username: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly enabled: boolean;
  readonly realmRoles?: readonly string[];
}

export interface HankoRole {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly composite: boolean;
}

export interface HankoRoleSpec {
  readonly name: string;
  readonly description?: string;
  readonly composite?: boolean;
  readonly composites?: readonly string[];
  readonly attributes?: Readonly<Record<string, readonly string[]>>;
}

export type HankoRolePatch = Omit<Partial<HankoRoleSpec>, "name">;

/** Server-side IAM client. The API enforces authority on every request.
 * Realm roles are not application-local roles; never pass realm-admin credentials
 * to an application as a substitute for organization-scoped delegation.
 */
export class HankoIamClient extends HankoOrganizationClient {
  /** Requires an administrator session; the returned credential stays server-side. */
  createOrganizationDelegation(realm: string, spec: HankoOrganizationDelegationSpec): Promise<HankoOrganizationDelegation> {
    return this.request("POST", `${realmPath(realm)}/org/delegations`, spec, [201]);
  }

  async listOrganizationDelegations(realm: string): Promise<HankoOrganizationDelegationMetadata[]> {
    const response = await this.request<{ delegations: HankoOrganizationDelegationMetadata[] }>("GET", `${realmPath(realm)}/org/delegations`);
    return list(response.delegations);
  }

  async revokeOrganizationDelegation(realm: string, id: string): Promise<void> {
    await this.request("DELETE", `${realmPath(realm)}/org/delegations/${pathSegment(id)}`, undefined, [204]);
  }

  async listUsers(realm: string): Promise<HankoUser[]> {
    const response = await this.request<{ users: HankoUser[] }>("GET", `${realmPath(realm)}/users`);
    return list(response.users);
  }

  getUser(realm: string, userId: string): Promise<HankoUser> {
    return this.request("GET", userPath(realm, userId));
  }

  async listRoles(realm: string): Promise<HankoRole[]> {
    const response = await this.request<{ roles: HankoRole[] }>("GET", `${realmPath(realm)}/roles`);
    return list(response.roles);
  }

  createRole(realm: string, spec: HankoRoleSpec): Promise<HankoRole> {
    return this.request("POST", `${realmPath(realm)}/roles`, spec, [201]);
  }

  async updateRole(realm: string, name: string, patch: HankoRolePatch): Promise<void> {
    await this.request("PATCH", `${realmPath(realm)}/roles/${pathSegment(name)}`, patch, [204]);
  }

  async deleteRole(realm: string, name: string): Promise<void> {
    await this.request("DELETE", `${realmPath(realm)}/roles/${pathSegment(name)}`, undefined, [204]);
  }

  async listUserRoles(realm: string, userId: string): Promise<string[]> {
    const response = await this.request<{ roles: string[] }>("GET", `${userPath(realm, userId)}/roles`);
    return list(response.roles);
  }

  async assignRole(realm: string, userId: string, role: string): Promise<void> {
    pathSegment(role);
    await this.request("POST", `${userPath(realm, userId)}/roles`, { role }, [204]);
  }

  async unassignRole(realm: string, userId: string, role: string): Promise<void> {
    await this.request("DELETE", `${userPath(realm, userId)}/roles/${pathSegment(role)}`, undefined, [204]);
  }
}

function userPath(realm: string, userId: string): string {
  return `${realmPath(realm)}/users/${pathSegment(userId)}`;
}

function list<T>(value: T[]): T[] {
  if (!Array.isArray(value)) throw new Error("Invalid Hanko IAM list response");
  return value;
}
