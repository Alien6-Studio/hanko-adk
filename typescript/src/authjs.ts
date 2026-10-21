import { getHankoLogoutToken } from "./logout.js";
import type { JWT } from "next-auth/jwt";
import type { OIDCConfig, OIDCUserConfig } from "next-auth/providers";

import { normalizeHankoClientConfig, type HankoClientConfig } from "./config.js";
import { HankoDiscovery, type HankoDiscoveryOptions } from "./discovery.js";
import type { HankoClaims } from "./principal.js";
import { requestHankoJson } from "./http.js";

export type HankoAuthJsOverrides = Pick<OIDCUserConfig<HankoAuthJsProfile>, "name" | "style" | "profile" | "account">;

export interface HankoAuthJsProfile extends HankoClaims {
  readonly realm_access?: { readonly roles?: readonly string[] };
}

export interface HankoRefreshableToken extends JWT {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  error?: string | undefined;
  logoutToken?: string | undefined;
}

export interface HankoRefreshOptions extends HankoDiscoveryOptions {
  readonly discovery?: HankoDiscovery;
  readonly now?: () => number;
  readonly errorCode?: string;
}

export const HANKO_REFRESH_ERROR = "HankoRefreshTokenError";

export function createHankoAuthJsProvider(
  config: HankoClientConfig,
  overrides: HankoAuthJsOverrides = {},
): OIDCConfig<HankoAuthJsProfile> {
  const allowed = new Set(["name", "style", "profile", "account"]);
  if (Object.keys(overrides).some((key) => !allowed.has(key))) {
    throw new Error("Unsupported Hanko Auth.js option");
  }
  const normalized = normalizeHankoClientConfig(config);
  return {
    id: "hanko",
    name: "Hanko",
    type: "oidc",
    checks: ["pkce", "state", "nonce"],
    options: {
      ...overrides,
      clientId: normalized.clientId,
      ...(normalized.clientSecret ? { clientSecret: normalized.clientSecret } : {}),
      issuer: normalized.issuer,
      checks: ["pkce", "state", "nonce"],
    },
  };
}

export async function refreshHankoAccessToken<T extends HankoRefreshableToken>(
  token: T,
  config: HankoClientConfig,
  options: HankoRefreshOptions = {},
): Promise<T & HankoRefreshableToken> {
  const errorCode = options.errorCode ?? HANKO_REFRESH_ERROR;
  if (!token.refreshToken) {
    return { ...token, error: errorCode };
  }

  try {
    const normalized = normalizeHankoClientConfig(config);
    const discovery = options.discovery ?? new HankoDiscovery(normalized.issuer, options);
    const metadata = await discovery.metadata(["token_endpoint"]);
    const tokenEndpoint = discovery.endpoint(metadata, "token_endpoint");
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: normalized.clientId,
      refresh_token: token.refreshToken,
    });
    if (normalized.clientSecret) {
      body.set("client_secret", normalized.clientSecret);
    }

    const refreshed = await requestHankoJson<{
      readonly access_token?: unknown;
      readonly refresh_token?: unknown;
      readonly expires_in?: unknown;
      readonly hanko_upstream_id_token?: unknown;
    }>(tokenEndpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      redirect: "error",
    }, options);
    if (
      typeof refreshed.access_token !== "string" ||
      typeof refreshed.expires_in !== "number" ||
      !Number.isFinite(refreshed.expires_in) ||
      refreshed.expires_in <= 0
    ) {
      return { ...token, error: errorCode };
    }

    const now = options.now ?? Date.now;
    return {
      ...token,
      accessToken: refreshed.access_token,
      logoutToken: getHankoLogoutToken(refreshed) ?? token.logoutToken,
      refreshToken:
        typeof refreshed.refresh_token === "string" && refreshed.refresh_token
          ? refreshed.refresh_token
          : token.refreshToken,
      expiresAt: Math.floor(now() / 1000) + Math.floor(refreshed.expires_in),
      error: undefined,
    };
  } catch {
    return { ...token, error: errorCode };
  }
}
