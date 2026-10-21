import { HankoOrganizationClient, pathSegment, type HankoOrganizationClientOptions, type HankoPositionMember } from "./organization.js";

export interface HankoDelegatedPosition {
  readonly id: string;
  readonly title: string;
  readonly parent_id?: string;
  readonly roles: readonly string[];
}

export interface HankoOrganizationDelegationSpec {
  readonly root_position_id: string;
  readonly application_id: string;
  readonly allowed_roles: readonly string[];
  readonly write_enabled: boolean;
  readonly expires_in_seconds: number;
}

export interface HankoOrganizationDelegationMetadata {
  readonly id: string;
  readonly sub: string;
  readonly kind: "organization";
  readonly realm_id: string;
  readonly scopes: readonly string[];
  readonly created_at: string;
  readonly expires_at: string;
  readonly organization: {
    readonly root_position_id: string;
    readonly root_group_id: string;
    readonly application_id: string;
    readonly allowed_roles: readonly string[];
  };
}

export interface HankoOrganizationDelegation {
  readonly token: string;
  readonly metadata: HankoOrganizationDelegationMetadata;
}

export interface HankoDelegatedOrganizationClientOptions extends HankoOrganizationClientOptions {
  readonly realm: string;
  readonly applicationId: string;
  readonly rootPositionId: string;
}

class DelegationTransport extends HankoOrganizationClient {
  call<T>(method: string, path: string, body?: unknown, expected = [200]): Promise<T> {
    return this.request<T>(method, path, body, expected);
  }
}

/** Backend-only membership client bound to one approved root and application.
 * The callback resolves a dedicated, revocable organization credential.
 * The API checks live provider authority; this client cannot edit the tree,
 * create realm roles or admit users from another root.
 */
export class HankoDelegatedOrganizationClient {
  readonly #transport: DelegationTransport;
  readonly #path: string;

  constructor(options: HankoDelegatedOrganizationClientOptions) {
    this.#path = `/api/v1/organization-admin/realms/${segment(options.realm)}/applications/${segment(options.applicationId)}/roots/${segment(options.rootPositionId)}/positions`;
    this.#transport = new DelegationTransport(options);
  }

  async listPositions(): Promise<HankoDelegatedPosition[]> {
    const response = await this.#transport.call<{ positions: HankoDelegatedPosition[] }>("GET", this.#path);
    if (!Array.isArray(response.positions)) throw new Error("Invalid Hanko delegated positions response");
    return response.positions;
  }

  async listMembers(positionId: string): Promise<HankoPositionMember[]> {
    const response = await this.#transport.call<{ members: HankoPositionMember[] }>("GET", `${this.#path}/${segment(positionId)}/members`);
    if (!Array.isArray(response.members)) throw new Error("Invalid Hanko members response");
    return response.members;
  }

  async assignMember(positionId: string, userId: string): Promise<void> {
    segment(userId);
    await this.#transport.call("POST", `${this.#path}/${segment(positionId)}/members`, { user_id: userId }, [204]);
  }

  async removeMember(positionId: string, userId: string): Promise<void> {
    await this.#transport.call("DELETE", `${this.#path}/${segment(positionId)}/members/${segment(userId)}`, undefined, [204]);
  }
}

function segment(value: string): string {
  if (new TextEncoder().encode(value).length > 255 || /[%?#\s]/u.test(value)) throw new Error("Invalid Hanko API path identifier");
  return pathSegment(value);
}
