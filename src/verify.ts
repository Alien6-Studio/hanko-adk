import { createRemoteJWKSet, customFetch, jwtVerify } from "jose";
import { checkAccessTokenPayload } from "./access-token.js";
import {
  normalizeHankoResourceServerConfig,
  type HankoResourceServerConfig,
} from "./config.js";
import { HankoDiscovery, type HankoDiscoveryOptions } from "./discovery.js";
import { requestHankoJson } from "./http.js";
import { createHankoPrincipal, type HankoPrincipal } from "./principal.js";

/** Reusable server verifier with issuer/audience pinning, bounded discovery and JWKS caching. */
export function createHankoAccessTokenVerifier(
  config: HankoResourceServerConfig,
  options: HankoDiscoveryOptions = {},
) {
  const settings = normalizeHankoResourceServerConfig(config);
  const discovery = new HankoDiscovery(settings.issuer, options);
  let keys: Promise<ReturnType<typeof createRemoteJWKSet>> | undefined;
  return async (token: string): Promise<HankoPrincipal> => {
    checkAccessTokenPayload(token);
    keys ??= discovery
      .metadata(["jwks_uri"])
      .then((metadata) =>
        createRemoteJWKSet(new URL(discovery.endpoint(metadata, "jwks_uri")), {
          timeoutDuration: options.timeoutMs ?? 5000,
          [customFetch]: async (url, init) =>
            Response.json(await requestHankoJson(url, init ?? {}, options)),
        }),
      )
      .catch((error) => {
        keys = undefined;
        throw error;
      });
    const { payload } = await jwtVerify(token, await keys, {
      issuer: settings.issuer,
      audience: settings.audience,
      algorithms: ["RS256"],
      clockTolerance: 30,
      currentDate: new Date(Date.now()),
    });
    // exp stays strict after network I/O; only iat/nbf permit the shared 30s skew.
    checkAccessTokenPayload(token);
    return createHankoPrincipal(payload, settings.issuer, settings.audience);
  };
}
