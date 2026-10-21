import { normalizeHankoClientConfig, type HankoClientConfig } from "./config.js";
import { HankoDiscovery } from "./discovery.js";
import { requestHankoJson, type HankoHttpOptions } from "./http.js";

const accessTokenType = "urn:ietf:params:oauth:token-type:access_token";

export interface HankoTokenSet {
  readonly access_token: string;
  readonly token_type: string;
  readonly expires_in: number;
  readonly scope?: string;
  readonly issued_token_type?: string;
}

export interface HankoTokenClientOptions extends HankoHttpOptions {
  /** Resolved for each request so projected credentials can rotate. Server-only. */
  readonly clientSecret?: () => string | Promise<string>;
}

export interface HankoTokenExchange {
  readonly subjectToken: string;
  readonly audience: string;
  readonly scopes: readonly string[];
  readonly actorToken?: string;
}

/** Backend and agent grants through Hanko discovery. This client does not create
 * delegation policies or establish token authenticity: the issuer bounds grants
 * and resource servers verify returned access tokens with their own audience.
 */
export class HankoTokenClient {
  readonly #config: HankoClientConfig;
  readonly #options: HankoTokenClientOptions;
  readonly #discovery: HankoDiscovery;

  constructor(config: HankoClientConfig, options: HankoTokenClientOptions = {}) {
    this.#config = normalizeHankoClientConfig(config);
    this.#options = { ...options };
    this.#discovery = new HankoDiscovery(this.#config.issuer, options);
  }

  clientCredentials(scopes: readonly string[] = []): Promise<HankoTokenSet> {
    return this.#request(new URLSearchParams({ grant_type: "client_credentials", scope: scopeValue(scopes) }));
  }

  exchangeToken(request: HankoTokenExchange): Promise<HankoTokenSet> {
    if (!request.subjectToken.trim() || !request.audience.trim() || request.scopes.length === 0 ||
        (request.actorToken !== undefined && !request.actorToken.trim())) {
      throw new Error("Hanko token exchange requires a subject token, audience and explicit scopes");
    }
    const body = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: request.subjectToken,
      subject_token_type: accessTokenType,
      requested_token_type: accessTokenType,
      audience: request.audience,
      scope: scopeValue(request.scopes),
    });
    if (request.actorToken !== undefined) {
      body.set("actor_token", request.actorToken);
      body.set("actor_token_type", accessTokenType);
    }
    return this.#request(body, true);
  }

  async #request(body: URLSearchParams, exchange = false): Promise<HankoTokenSet> {
    const secret = (await (this.#options.clientSecret?.() ?? this.#config.clientSecret))?.trim();
    if (!secret) throw new Error("Hanko backend grants require a client secret");
    body.set("client_id", this.#config.clientId);
    body.set("client_secret", secret);
    const metadata = await this.#discovery.metadata(["token_endpoint"]);
    const result = await requestHankoJson<HankoTokenSet>(this.#discovery.endpoint(metadata, "token_endpoint"), {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }, this.#options);
    if (!result || typeof result.access_token !== "string" || !result.access_token.trim() ||
        typeof result.token_type !== "string" || result.token_type.toLowerCase() !== "bearer" ||
        !Number.isSafeInteger(result.expires_in) || result.expires_in < 1 || result.expires_in > 3600 ||
        (result.scope !== undefined && typeof result.scope !== "string") ||
        (exchange && result.issued_token_type !== accessTokenType)) {
      throw new Error("Invalid Hanko access-token response");
    }
    // Do not return unexpected provider fields, refresh tokens or ID tokens.
    return {
      access_token: result.access_token, token_type: "Bearer", expires_in: result.expires_in,
      ...(result.scope === undefined ? {} : { scope: result.scope }),
      ...(exchange ? { issued_token_type: accessTokenType } : {}),
    };
  }
}

function scopeValue(scopes: readonly string[]): string {
  if (scopes.some((scope) => !/^[\x21\x23-\x5b\x5d-\x7e]+$/u.test(scope))) {
    throw new Error("Invalid Hanko OAuth scope");
  }
  return [...new Set(scopes)].join(" ");
}
