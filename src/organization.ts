import { requestHankoJson, type HankoHttpOptions } from "./http.js";

export interface HankoOrganizationPosition {
  readonly id: string;
  readonly realm: string;
  readonly title: string;
  readonly parent_id?: string;
  readonly group_id?: string;
  readonly role_ids: readonly string[];
  readonly created_at?: string;
}

export interface HankoOrganizationPositionSpec {
  readonly title: string;
  readonly parent_id?: string;
  readonly group_id?: string;
  readonly role_ids: readonly string[];
}

export type HankoAccessTokenSource = () => string | Promise<string>;

export interface HankoOrganizationClientOptions extends HankoHttpOptions {
  readonly apiUrl: string;
  readonly accessToken: HankoAccessTokenSource;
}

interface PositionListResponse {
  readonly positions: HankoOrganizationPosition[];
}

export interface HankoPositionMember {
  readonly position_id: string;
  readonly realm: string;
  readonly user_id: string;
  readonly assigned_at: string;
}

/**
 * Realm-neutral client for Hanko's supported organization management API.
 * Products never call Keycloak directly and never depend on Hanko's database.
 */
export class HankoOrganizationClient {
  readonly #apiUrl: string;
  readonly #accessToken: HankoAccessTokenSource;
  readonly #options: HankoHttpOptions;

  constructor(options: HankoOrganizationClientOptions) {
    this.#apiUrl = normalizeApiUrl(options.apiUrl);
    this.#accessToken = options.accessToken;
    this.#options = { ...options };
  }

  async listPositions(realm: string): Promise<HankoOrganizationPosition[]> {
    const response = await this.request<PositionListResponse>("GET", collectionPath(realm));
    return response.positions ?? [];
  }

  createPosition(realm: string, spec: HankoOrganizationPositionSpec): Promise<HankoOrganizationPosition> {
    return this.request("POST", collectionPath(realm), spec, [201]);
  }

  async updatePosition(realm: string, positionId: string, spec: HankoOrganizationPositionSpec): Promise<void> {
    await this.request("PATCH", positionPath(realm, positionId), spec, [204]);
  }

  async deletePosition(realm: string, positionId: string): Promise<void> {
    await this.request("DELETE", positionPath(realm, positionId), undefined, [204, 404]);
  }

  getPosition(realm: string, positionId: string): Promise<HankoOrganizationPosition> {
    return this.request("GET", positionPath(realm, positionId));
  }

  async listMembers(realm: string, positionId: string): Promise<HankoPositionMember[]> {
    const response = await this.request<{ members: HankoPositionMember[] }>("GET", `${positionPath(realm, positionId)}/members`);
    if (!Array.isArray(response.members)) throw new Error("Invalid Hanko members response");
    return response.members;
  }

  async assignMember(realm: string, positionId: string, userId: string): Promise<void> {
    pathSegment(userId);
    await this.request("POST", `${positionPath(realm, positionId)}/members`, { user_id: userId }, [204]);
  }

  async removeMember(realm: string, positionId: string, userId: string): Promise<void> {
    await this.request("DELETE", `${positionPath(realm, positionId)}/members/${pathSegment(userId)}`, undefined, [204]);
  }

  protected async request<T>(method: string, path: string, body?: unknown, expected = [200], signal?: AbortSignal): Promise<T> {
    const token = (await this.#accessToken()).trim();
    if (!token) throw new Error("Hanko organization access token is empty");
    return requestHankoJson<T>(`${this.#apiUrl}${path}`, {
      method,
      ...(signal ? { signal } : {}),
      redirect: "error",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }, this.#options, expected);
  }
}

function normalizeApiUrl(raw: string): string {
  let value: URL;
  try {
    value = new URL(raw.trim());
  } catch {
    throw new Error("Hanko API URL must be absolute");
  }
  if (value.username || value.password || value.search || value.hash) {
    throw new Error("Hanko API URL must not contain credentials, query parameters or a fragment");
  }
  const loopback = value.hostname === "localhost" || value.hostname === "127.0.0.1" || value.hostname === "[::1]";
  if (value.protocol !== "https:" && !(value.protocol === "http:" && loopback)) {
    throw new Error("Hanko API URL must use HTTPS outside loopback development");
  }
  return value.toString().replace(/\/+$/, "");
}

function collectionPath(realm: string): string {
  return `${realmPath(realm)}/org/positions`;
}

function positionPath(realm: string, positionId: string): string {
  return `${collectionPath(realm)}/${pathSegment(positionId)}`;
}

export function realmPath(realm: string): string {
  return `/api/v1/realms/${pathSegment(realm)}`;
}

export function pathSegment(value: string): string {
  if (!value || value.trim() !== value || value === "." || value === ".." || /[/\\\x00-\x1f\x7f]/u.test(value)) {
    throw new Error("Invalid Hanko API path identifier");
  }
  return encodeURIComponent(value);
}
