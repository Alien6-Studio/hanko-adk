import { passportJwtSecret } from "jwks-rsa";
import { ExtractJwt, type SecretOrKeyProvider, type StrategyOptions } from "passport-jwt";

export { loadHankoResourceServerConfig } from "./config.js";
import {
  normalizeHankoResourceServerConfig,
  type HankoResourceServerConfig,
} from "./config.js";
import { HankoDiscovery, type HankoDiscoveryOptions } from "./discovery.js";
import { checkAccessTokenPayload } from "./access-token.js";

export interface HankoJwksOptions extends HankoDiscoveryOptions {
  readonly cache?: boolean;
  readonly rateLimit?: boolean;
  readonly jwksRequestsPerMinute?: number;
}

export function createHankoJwksSecretProvider(
  issuer: string,
  options: HankoJwksOptions = {},
): SecretOrKeyProvider {
  const discovery = new HankoDiscovery(issuer, options);
  let delegatePromise: Promise<SecretOrKeyProvider> | undefined;

  const loadDelegate = (): Promise<SecretOrKeyProvider> => {
    if (!delegatePromise) {
      delegatePromise = discovery
        .metadata(["jwks_uri"])
        .then((metadata) =>
          passportJwtSecret({
            cache: options.cache ?? true,
            rateLimit: options.rateLimit ?? true,
            jwksRequestsPerMinute: options.jwksRequestsPerMinute ?? 5,
            jwksUri: discovery.endpoint(metadata, "jwks_uri"),
          }),
        )
        .catch((error: unknown) => {
          delegatePromise = undefined;
          throw error;
        });
    }
    return delegatePromise;
  };

  return (request, rawJwtToken, done): void => {
    try {
      checkAccessTokenPayload(rawJwtToken);
    } catch (error: unknown) {
      done(error);
      return;
    }
    void loadDelegate()
      .then((delegate) => delegate(request, rawJwtToken, done))
      .catch((error: unknown) => done(error));
  };
}

export function createHankoJwtStrategyOptions(
  config: HankoResourceServerConfig,
  options: HankoJwksOptions = {},
): StrategyOptions {
  const normalized = normalizeHankoResourceServerConfig(config);
  return {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKeyProvider: createHankoJwksSecretProvider(normalized.issuer, options),
    issuer: normalized.issuer,
    audience: normalized.audience,
    algorithms: ["RS256"],
    ignoreExpiration: false,
    // The payload gate enforces nbf's 30s skew. Passport retains strict exp.
    jsonWebTokenOptions: { ignoreNotBefore: true },
  };
}
