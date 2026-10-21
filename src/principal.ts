import { normalizeHankoIssuer } from "./config.js";

export interface HankoClaims extends Record<string, unknown> {
  readonly iss?: string;
  readonly sub?: string;
  readonly aud?: string | readonly string[];
  readonly email?: string;
  readonly name?: string;
  readonly preferred_username?: string;
}

export interface HankoPrincipal {
  readonly issuer: string;
  readonly subject: string;
  readonly audiences: readonly string[];
  readonly email?: string;
  readonly name?: string;
  readonly claims: HankoClaims;
}

function audiencesOf(claims: HankoClaims): readonly string[] {
  if (claims.aud === undefined) {
    return [];
  }
  if (typeof claims.aud === "string") {
    if (claims.aud.trim()) {
      return [claims.aud];
    }
  }
  if (
    Array.isArray(claims.aud) &&
    claims.aud.length > 0 &&
    claims.aud.every((value) => typeof value === "string" && value.trim())
  ) {
    return claims.aud;
  }
  throw new Error("Hanko claims contain an invalid audience");
}

export function createHankoPrincipal(
  claims: HankoClaims,
  expectedIssuer: string,
  expectedAudience?: string,
): HankoPrincipal {
  const normalizedExpectedIssuer = normalizeHankoIssuer(expectedIssuer);
  const issuer = typeof claims.iss === "string" ? claims.iss : "";
  if (!issuer || issuer !== normalizedExpectedIssuer) {
    throw new Error("Hanko claims issuer does not match the configured issuer");
  }
  if (typeof claims.sub !== "string" || !claims.sub.trim()) {
    throw new Error("Hanko claims do not contain a subject");
  }

  const audiences = audiencesOf(claims);
  const normalizedExpectedAudience = expectedAudience?.trim();
  if (expectedAudience !== undefined && !normalizedExpectedAudience) {
    throw new Error("The expected Hanko audience is required");
  }
  if (normalizedExpectedAudience && !audiences.includes(normalizedExpectedAudience)) {
    throw new Error("Hanko claims do not contain the configured audience");
  }

  const email = typeof claims.email === "string" ? claims.email : undefined;
  const name = typeof claims.name === "string" ? claims.name : undefined;
  return {
    issuer,
    subject: claims.sub,
    audiences,
    ...(email ? { email } : {}),
    ...(name ? { name } : {}),
    claims,
  };
}
