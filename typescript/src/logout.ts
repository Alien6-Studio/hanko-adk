import { normalizeHankoClientConfig, type HankoClientConfig } from "./config.js";
import { HankoDiscovery, type HankoDiscoveryOptions } from "./discovery.js";

export interface HankoLogoutRequest {
  readonly logoutToken: string;
  readonly postLogoutRedirectUri: string;
  readonly state?: string;
}

/** Extract the private logout hint; never substitute Hanko's public ID token. */
export function getHankoLogoutToken(response: Readonly<Record<string, unknown>>): string | undefined {
  const hint = response["hanko_upstream_id_token"];
  return typeof hint === "string" && hint.trim() ? hint : undefined;
}

/** Build RP logout using validated discovery and an explicitly registered return URI. */
export async function createHankoLogoutUrl(
  config: HankoClientConfig,
  request: HankoLogoutRequest,
  options: HankoDiscoveryOptions = {},
): Promise<string> {
  const normalized = normalizeHankoClientConfig(config);
  if (!request.logoutToken.trim()) throw new Error("Hanko logout requires an upstream ID token hint");
  const redirect = new URL(request.postLogoutRedirectUri);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(redirect.hostname);
  if (redirect.username || redirect.password || redirect.hash ||
      (redirect.protocol !== "https:" && !(redirect.protocol === "http:" && loopback))) {
    throw new Error("Hanko logout return URI must use HTTPS outside loopback and contain no credentials or fragment");
  }
  const discovery = new HankoDiscovery(normalized.issuer, options);
  const metadata = await discovery.metadata(["end_session_endpoint"]);
  const url = new URL(discovery.endpoint(metadata, "end_session_endpoint"));
  url.searchParams.set("client_id", normalized.clientId);
  url.searchParams.set("id_token_hint", request.logoutToken);
  url.searchParams.set("post_logout_redirect_uri", redirect.toString());
  if (request.state !== undefined) url.searchParams.set("state", request.state);
  return url.toString();
}
