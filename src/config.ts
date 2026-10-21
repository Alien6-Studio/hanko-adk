export const HANKO_ENVIRONMENT_KEYS = {
  issuer: "HANKO_ISSUER",
  clientId: "HANKO_CLIENT_ID",
  clientSecret: "HANKO_CLIENT_SECRET",
  audience: "HANKO_AUDIENCE",
} as const;

export type HankoEnvironment = Readonly<Record<string, string | undefined>>;

export interface HankoClientConfig {
  readonly issuer: string;
  readonly clientId: string;
  readonly clientSecret?: string;
}

export interface HankoResourceServerConfig {
  readonly issuer: string;
  readonly audience: string;
}

function required(environment: HankoEnvironment, key: string): string {
  const value = environment[key]?.trim();
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
}

function requiredConfigValue(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field} is required`);
  }
  return normalized;
}

function isLoopback(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function normalizeHankoIssuer(rawIssuer: string): string {
  const value = rawIssuer.trim();
  if (!value) {
    throw new Error(`${HANKO_ENVIRONMENT_KEYS.issuer} is required`);
  }

  let issuer: URL;
  try {
    issuer = new URL(value);
  } catch {
    throw new Error(`${HANKO_ENVIRONMENT_KEYS.issuer} must be an absolute URL`);
  }

  if (issuer.username || issuer.password || issuer.search || issuer.hash) {
    throw new Error(`${HANKO_ENVIRONMENT_KEYS.issuer} must not contain credentials, query parameters or a fragment`);
  }
  if (issuer.protocol !== "https:" && !(issuer.protocol === "http:" && isLoopback(issuer.hostname))) {
    throw new Error(`${HANKO_ENVIRONMENT_KEYS.issuer} must use HTTPS outside loopback development`);
  }

  return issuer.toString().replace(/\/+$/, "");
}

export function normalizeHankoClientConfig(config: HankoClientConfig): HankoClientConfig {
  const clientSecret = config.clientSecret?.trim();
  return {
    issuer: normalizeHankoIssuer(config.issuer),
    clientId: requiredConfigValue(config.clientId, HANKO_ENVIRONMENT_KEYS.clientId),
    ...(clientSecret ? { clientSecret } : {}),
  };
}

export function normalizeHankoResourceServerConfig(
  config: HankoResourceServerConfig,
): HankoResourceServerConfig {
  return {
    issuer: normalizeHankoIssuer(config.issuer),
    audience: requiredConfigValue(config.audience, HANKO_ENVIRONMENT_KEYS.audience),
  };
}

export function loadHankoClientConfig(environment: HankoEnvironment): HankoClientConfig {
  const clientSecret = environment[HANKO_ENVIRONMENT_KEYS.clientSecret];
  return normalizeHankoClientConfig({
    issuer: required(environment, HANKO_ENVIRONMENT_KEYS.issuer),
    clientId: required(environment, HANKO_ENVIRONMENT_KEYS.clientId),
    ...(clientSecret === undefined ? {} : { clientSecret }),
  });
}

export function loadHankoResourceServerConfig(environment: HankoEnvironment): HankoResourceServerConfig {
  return normalizeHankoResourceServerConfig({
    issuer: required(environment, HANKO_ENVIRONMENT_KEYS.issuer),
    audience: required(environment, HANKO_ENVIRONMENT_KEYS.audience),
  });
}
