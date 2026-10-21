const CLOCK_SKEW_SECONDS = 30;
const MAX_LIFETIME_SECONDS = 3600;

function numericDate(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

/** Reject unsuitable claims; signature verification is still mandatory. */
export function checkAccessTokenPayload(rawToken: unknown): void {
  if (typeof rawToken !== "string" || rawToken.length > 64 * 1024) {
    throw new Error("Invalid Hanko access token");
  }
  const parts = rawToken.split(".");
  if (parts.length !== 3 || !parts[1] || !/^[A-Za-z0-9_-]+$/.test(parts[1])) {
    throw new Error("Invalid Hanko access token");
  }
  let claims: Record<string, unknown>;
  try {
    const decoded: unknown = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
      throw new Error("Invalid claims");
    }
    claims = decoded as Record<string, unknown>;
  } catch {
    throw new Error("Invalid Hanko access token claims");
  }
  if (claims.hanko_token_use !== "access" || typeof claims.sub !== "string" || !claims.sub.trim()) {
    throw new Error("A Hanko access token with a subject is required");
  }
  const now = Math.floor(Date.now() / 1000);
  if (!numericDate(claims.exp) || claims.exp <= now) {
    throw new Error("Hanko access token expiration is missing, invalid or expired");
  }
  if (!numericDate(claims.iat) || claims.iat > now + CLOCK_SKEW_SECONDS) {
    throw new Error("Hanko access token issuance is missing, invalid or in the future");
  }
  if (claims.exp <= claims.iat || claims.exp - claims.iat > MAX_LIFETIME_SECONDS) {
    throw new Error("Hanko access token lifetime must be positive and at most one hour");
  }
  if ("nbf" in claims && (!numericDate(claims.nbf) || claims.nbf > now + CLOCK_SKEW_SECONDS || claims.nbf >= claims.exp)) {
    throw new Error("Hanko access token not-before claim is invalid or in the future");
  }
}
