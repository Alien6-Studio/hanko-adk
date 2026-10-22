/** Parameters for the host OIDC client's authorization request. Keep the host's
 * normal state, nonce, PKCE and callback handling; never construct a bare redirect.
 * Keycloak owns profile validation, federation restrictions and verification.
 */
export function hankoAccountAction(action: "profile" | "password" | "email" | "otp"): Readonly<{ kc_action: string }> {
  const actions = { profile: "UPDATE_PROFILE", password: "UPDATE_PASSWORD", email: "UPDATE_EMAIL", otp: "CONFIGURE_TOTP" } as const;
  if (!Object.hasOwn(actions, action)) throw new Error("Unknown Hanko account action");
  return { kc_action: actions[action] };
}
