import { requestHankoJson, type HankoFetch } from "./http.js";
import {
  bounded as validateField,
  identifier as validateIdentifier,
  validateHankoAccount,
  validateHankoOrganization,
  type HankoIdentityController,
  type HankoOrganizationDetails,
} from "./identity.js";

export interface HankoIdentitySession {
  subject: string;
  controller: HankoIdentityController;
}
export class HankoIdentityError extends Error {
  constructor(readonly status: number) {
    super("Identity request refused");
  }
}

/** Bind a fresh verified session and its scoped backend adapter on every request. */
export function createHankoIdentityHandler(options: {
  authorize(request: Request): Promise<HankoIdentitySession | null>;
  origin?: string;
}) {
  return async (request: Request): Promise<Response> => {
    const json = (value: unknown, status = 200) =>
      Response.json(value, {
        status,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    try {
      if (request.method !== "GET" && request.method !== "POST")
        return json({ error: "method_not_allowed" }, 405);
      if (
        request.method === "POST" &&
        (request.headers.get("sec-fetch-site") === "cross-site" ||
          request.headers.get("origin") !==
            (options.origin ?? new URL(request.url).origin))
      )
        return json({ error: "forbidden" }, 403);
      const session = await options.authorize(request);
      if (!session?.subject) return json({ error: "unauthorized" }, 401);
      const { controller } = session;
      const account = await controller.account(request.signal);
      validateHankoAccount(account, session.subject);
      async function organization(
        value: unknown,
      ): Promise<HankoOrganizationDetails> {
        identifier(value);
        if (
          !account.organizations.some(
            (organization) => organization.id === value,
          )
        )
          throw new HankoIdentityError(404);
        const details = await controller.organization(value, request.signal);
        validateHankoOrganization(details, value);
        return details;
      }
      if (request.method === "GET") {
        const id = new URL(request.url).searchParams.get("organization");
        return json(id === null ? account : await organization(id));
      }
      if (
        !request.headers
          .get("content-type")
          ?.toLowerCase()
          .startsWith("application/json")
      )
        return json({ error: "invalid_request" }, 400);
      const input = await body(request);
      if (input.action === "createOrganization") {
        keys(input, ["action", "input"]);
        if (!account.canCreateOrganization || !controller.createOrganization)
          throw new HankoIdentityError(403);
        const data = object(input.input);
        keys(data, ["name", "slug"]);
        bounded(data.name, 100);
        bounded(data.slug, 63);
        if (
          !data.name.trim() ||
          !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/u.test(data.slug)
        )
          throw new HankoIdentityError(400);
        await controller.createOrganization(
          { name: data.name.trim(), slug: data.slug },
          request.signal,
        );
      } else {
        const details = await organization(input.organization);
        const id = details.organization.id;
        switch (input.action) {
          case "updateOrganization": {
            keys(input, ["action", "organization", "input"]);
            if (!details.permissions.edit || !controller.updateOrganization)
              throw new HankoIdentityError(403);
            const data = object(input.input);
            keys(data, ["name", "description", "website", "email"]);
            bounded(data.name, 256);
            if (!data.name.trim()) throw new HankoIdentityError(400);
            for (const field of ["description", "website", "email"])
              if (data[field] !== undefined)
                bounded(data[field], field === "description" ? 2000 : 320);
            await controller.updateOrganization(
              id,
              data as unknown as { name: string },
              request.signal,
            );
            break;
          }
          case "inviteMember": {
            keys(input, ["action", "organization", "input"]);
            if (!details.permissions.invite || !controller.inviteMember)
              throw new HankoIdentityError(403);
            const data = object(input.input);
            keys(data, ["email", "role"]);
            bounded(data.email, 320);
            bounded(data.role, 255);
            if (
              !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(data.email) ||
              !details.roles.some((role) => role.id === data.role)
            )
              throw new HankoIdentityError(400);
            await controller.inviteMember(
              id,
              { email: data.email, role: data.role },
              request.signal,
            );
            break;
          }
          case "changeMemberRole":
          case "removeMember": {
            keys(
              input,
              input.action === "removeMember"
                ? ["action", "organization", "member"]
                : ["action", "organization", "member", "role"],
            );
            if (!details.permissions.manageMembers)
              throw new HankoIdentityError(403);
            identifier(input.member);
            if (!details.members.some((member) => member.id === input.member))
              throw new HankoIdentityError(404);
            if (input.action === "removeMember") {
              if (!controller.removeMember) throw new HankoIdentityError(403);
              await controller.removeMember(id, input.member, request.signal);
            } else {
              bounded(input.role, 255);
              if (
                !controller.changeMemberRole ||
                !details.roles.some((role) => role.id === input.role)
              )
                throw new HankoIdentityError(403);
              await controller.changeMemberRole(
                id,
                input.member,
                input.role,
                request.signal,
              );
            }
            break;
          }
          default:
            throw new HankoIdentityError(400);
        }
      }
      return new Response(null, {
        status: 204,
        headers: { "Cache-Control": "no-store" },
      });
    } catch (error) {
      return json(
        { error: "identity_request_refused" },
        error instanceof HankoIdentityError ? error.status : 502,
      );
    }
  };
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new HankoIdentityError(400);
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some((key) => !allowed.includes(key)))
    throw new HankoIdentityError(400);
}
async function body(request: Request): Promise<Record<string, unknown>> {
  if (Number(request.headers.get("content-length")) > 16384)
    throw new HankoIdentityError(413);
  const reader = request.body?.getReader();
  if (!reader) throw new HankoIdentityError(400);
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 16384) throw new HankoIdentityError(413);
      chunks.push(part.value);
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  const data = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return object(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(data)),
    );
  } catch {
    throw new HankoIdentityError(400);
  }
}

// Invalid caller input is a 400; malformed backend context remains a 502.
function bounded(value: unknown, limit: number): asserts value is string {
  try {
    validateField(value, limit);
  } catch {
    throw new HankoIdentityError(400);
  }
}
function identifier(value: unknown): asserts value is string {
  try {
    validateIdentifier(value);
  } catch {
    throw new HankoIdentityError(400);
  }
}

/** Public presentation only: fixed upstream URL, no application cookies or tokens. */
export function createHankoAppearanceProxy(options: {
  url: string;
  fetch?: import("./http.js").HankoFetch;
}) {
  const url = new URL(options.url);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new Error("Invalid appearance URL");
  return async (): Promise<Response> => {
    try {
      const appearance = await requestHankoJson(
        url,
        { credentials: "omit", cache: "no-store" },
        options,
      );
      return Response.json(appearance, {
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      return Response.json(
        { error: "appearance_unavailable" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
  };
}

/** Fixed application API origin; forwards only the host's server-side session token. */
export function createHankoIdentityBackend(options: {
  baseUrl: string;
  accessToken: () => string | Promise<string>;
  fetch?: HankoFetch;
}) {
  const base = new URL(options.baseUrl);
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  )
    throw new Error("Invalid application API URL");
  return async <T>(
    path: string,
    signal: AbortSignal,
    method = "GET",
    body?: unknown,
  ): Promise<T> => {
    if (!/^\/(?!\/)[^\\\s#]*$/u.test(path))
      throw new Error("Invalid application API path");
    const token = await options.accessToken();
    if (!token || /\s/u.test(token)) throw new HankoIdentityError(401);
    return requestHankoJson<T>(
      `${base.href.replace(/\/$/u, "")}${path}`,
      {
        method,
        signal,
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      },
      {
        fetch: async (url, init) => {
          const response = await (options.fetch ?? globalThis.fetch)(url, init);
          if (!response.ok) {
            void response.body?.cancel().catch(() => undefined);
            throw new HankoIdentityError(
              [400, 401, 403, 404, 409, 422, 429, 503].includes(response.status)
                ? response.status
                : 502,
            );
          }
          return response;
        },
      },
      [200, 201, 204],
    );
  };
}
