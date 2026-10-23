# HankoShell TypeScript ADK

Application authentication, backend adapters and reusable account screens for HankoShell.
Use Node 22 or 24. The first npm release is being prepared.

[![CI](https://github.com/Alien6-Studio/hankoshell-typescript-adk/actions/workflows/ci.yml/badge.svg)](https://github.com/Alien6-Studio/hankoshell-typescript-adk/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

## Configure

```text
HANKO_ISSUER=https://auth.example.test/realms/example
HANKO_CLIENT_ID=example-app
HANKO_CLIENT_SECRET=<server-only secret, when required>
HANKO_AUDIENCE=example-api
```

Keep client secrets in your application’s secret mechanism and out of browser bundles.

## Auth.js

```ts
import NextAuth from "next-auth";
import { loadHankoClientConfig } from "@alien6/hankoshell-typescript-adk";
import { createHankoAuthJsProvider } from "@alien6/hankoshell-typescript-adk/authjs";

export const { handlers, auth } = NextAuth({
  providers: [createHankoAuthJsProvider(loadHankoClientConfig(process.env))],
});
```

The adapter preserves PKCE, state, nonce and the configured issuer and endpoints.
Only `name`, `style`, `profile` and `account` may be customized. Applications own
session storage and their business roles. Install the optional Auth.js peer when
using this entry point.

## Passport / NestJS

```ts
import { Strategy } from "passport-jwt";
import {
  loadHankoResourceServerConfig,
  createHankoPrincipal,
} from "@alien6/hankoshell-typescript-adk";
import { createHankoJwtStrategyOptions } from "@alien6/hankoshell-typescript-adk/passport";

const config = loadHankoResourceServerConfig(process.env);
const strategy = new Strategy(
  createHankoJwtStrategyOptions(config),
  (claims, done) => {
    try {
      done(null, createHankoPrincipal(claims, config.issuer, config.audience));
    } catch (error) {
      done(error);
    }
  },
);
```

Passport performs signature verification before the callback. Calling
`createHankoPrincipal` by itself does not authenticate a token. Install the
optional `passport-jwt` peer for this entry point.

## React account screens

Use **headless IAM with host-owned UI components** for application screens.
The ADK owns account and organization loading, mutations and permission checks;
the application owns its Next.js routes, navigation and design system.

`HankoIdentityScreen` from `/identity/react` accepts a required `ui` adapter for
the application's buttons, fields, selects, cards and member lists. It injects
no CSS, theme variables, navigation frame or iframe and needs only React.
Bind your existing shadcn/ui components using [the reference adapter](examples/shadcn-ui.tsx),
or bind another design system through the same typed contract. No second copy
of shadcn or Radix is installed by the ADK.

```tsx
"use client";
import { HankoIdentityScreen } from "@alien6/hankoshell-typescript-adk/identity/react";
import { createHankoIdentityClient } from "@alien6/hankoshell-typescript-adk/identity";
import { hankoIdentityUI } from "./hanko-identity-ui";

const controller = createHankoIdentityClient({ endpoint: "/api/account" });
export function OrganizationPage({ subject }: { subject: string }) {
  return (
    <HankoIdentityScreen
      subject={subject}
      controller={controller}
      page="organizations"
      ui={hankoIdentityUI}
      locale="fr"
    />
  );
}
```

Pages cover profile, organizations, access and security. Organization screens
include details, members, invitations, role changes and removal when the backend
authorizes them. `editableFields` narrows organization fields to those the product
supports; the server handler enforces this allowlist too. Unsupported actions stay
hidden, and read-only access is explicit. Selecting an organization to administer
does not switch the application's active tenant.

For custom layouts, use `useHankoAccount`, `useHankoOrganization` and
`useHankoIdentityMutation`. These retain validation, cancellation and mutation state.
`HankoIdentityView` accepts an already-loaded, subject-bound account.

The `/react` entry also provides `HankoIdentityPage` for the same native integration
with live Theme Builder titles and descriptions: pass `ui`, `theme` and `page`.
`HankoIdentityPortal` remains available for standalone themed portals. Applications
should use native pages. Only these themed adapters require Theme Builder.

`createHankoIdentityHandler` from `/identity/server` exposes this same-origin
endpoint. Its `authorize(request)` callback must verify the current session and
return `{ subject, controller }`. Implement that controller against your existing
server-authorized APIs; `createHankoIdentityBackend` supplies bounded authenticated
transport. Set `origin` to the configured public application origin behind a proxy.
Every request rechecks identity, organization membership and allowed operations;
backend authorization remains mandatory. No browser administrator token is needed.
Unsupported operations stay hidden. Business organization data stays in the application.

For `profile`, `password`, `email` and `otp`, pass `hankoAccountAction(action)` to
your OIDC client's normal sign-in flow (Auth.js third argument). The host retains
state, nonce, PKCE and callback handling; Keycloak enforces editable fields and
federation restrictions. Wire `logout` to your application's normal sign-out.
The Theme Builder's `theme.runtime` supports live appearance updates through
`createHankoAppearanceProxy`, using a fixed public upstream and no session credentials.
Customize page titles and descriptions with `theme.modules["account.profile"]`
(and `account.organizations`, `account.access`, `account.security`); each accepts
`title` and `description` strings or `{ en, fr }` translations.

## Application authorization

For a backend without Passport, `createHankoAccessTokenVerifier({ issuer, audience })`
returns a verifier with bounded discovery, cached JWKS and the shared access-token
checks. After verifying the token, call `resolveHankoApplicationAccess(principal, audience)`
to resolve application roles and the active organization. A present organization
claim must select exactly one organization: ambiguous or malformed claims grant no
roles, and top-level roles from other organizations cannot fill the gap. Product
APIs keep checking ownership of their business resources; Hanko supplies IAM authority.

## IAM and backend clients

HankoShell owns identity and IAM policy across Alien6 products. Keycloak provides
SSO and the registered client's login theme; applications use their own client ID
and audience, with no theme or realm-policy override in the ADK.

`HankoIamClient` extends `HankoOrganizationClient` with directory reads, position
memberships, realm-role CRUD and direct user-role assignments. Both take the same
`{ apiUrl, accessToken }` options. The callback supplies the caller's current
short-lived token; Hanko authorizes each operation. The existing management API
still requires realm administration for its members and roles. Product backends
use `HankoDelegatedOrganizationClient` with a dedicated organization credential,
resolved through the same `accessToken` callback. Bind `realm`, `applicationId`
and `rootPositionId` at construction. It lists approved positions and changes
membership only for existing root members; the API verifies current group and
role boundaries before writes. Operator-owned structure and root admission remain
separate. Never distribute realm-admin credentials to application clients.

`createOrganizationDelegation`, `listOrganizationDelegations` and
`revokeOrganizationDelegation` on `HankoIamClient` manage these credentials.
Issuance requires an administrator session, an explicit role allowlist and an
expiry of 5 minutes to 24 hours. Keep the returned secret server-side; it cannot
call ordinary realm-administration endpoints. This requires the matching platform
API; it does not enable interactive active-node selection or agent delegation.

```ts
const iam = new HankoIamClient({
  apiUrl,
  accessToken: () => session.accessToken,
});
const positions = await iam.listPositions(realm);
const members = await iam.listMembers(realm, positionId);
```

`HankoTokenClient` supports server-side client credentials and explicit
RFC 8693 exchanges (`subjectToken`, `audience`, `scopes`, optional `actorToken`).
Pass a `clientSecret` callback in its options for rotating credentials. These are
protocol helpers: agent delegation additionally requires issuer trust, bounded
policy and end-to-end qualification of the Hanko facade and Keycloak extension.
The facade currently forwards exchange inputs unchanged; do not assume it can
exchange a Hanko re-signed subject token. Resource servers independently verify
every returned access token. Tokens and secrets are never persisted by the ADK.

## Refresh and logout

`refreshHankoAccessToken` uses same-origin discovery and refuses HTTP failures.
The caller must handle `HankoRefreshTokenError` by requiring authentication.
`getHankoLogoutToken` retains Hanko's private upstream hint for server-side
sessions; `createHankoLogoutUrl` constructs RP-initiated logout. Never expose the
hint in a browser session or substitute a different ID token.

`HankoOrganizationClient` uses a supplied short-lived access-token callback.
Requests refuse redirects and default to five seconds and 1 MiB. `timeoutMs`
and `maxResponseBytes` can lower those limits or set a timeout up to 60 seconds.

## Develop and release

```sh
npm ci
npm run check
```

The package uses ESM and typed exports. Releases use `vX.Y.Z` tags matching
`package.json`; npm publication requires control of the `@alien6` scope and its
configured trusted publisher. Released versions are immutable.

The [Go ADK](https://github.com/Alien6-Studio/hankoshell-golang-adk) is maintained
separately. Both ADKs carry the same synthetic access-token vectors in `testdata/`.
The portable manifest is [integration v1](contracts/integration-v1.schema.json).
Applications retain their sessions and business authorization. Hanko's API owns
administration boundaries; the [operator](https://github.com/Alien6-Studio/hankoshell-operator)
reconciles declarative IAM configuration.

See [contribution](CONTRIBUTING.md) and [security reporting](SECURITY.md).

Copyright 2026 Alien6 Studio. Licensed under Apache-2.0.

## Attestation

The [Attestation workflow](https://github.com/Alien6-Studio/hankoshell-typescript-adk/actions/workflows/attest.yml)
runs the tests and builds a package without signing credentials. A separate job
recomputes the evidence against the reviewed commit, signs it with Continuum
Attest 0.2.0 and verifies signature, hashes and successful execution. Releases
publish that exact package. The public signer is pinned in [.github/attest/trust](.github/attest/trust).

To check a downloaded proof, check out its source revision and restore the
`signed-attestation` artifact at the repository root, then run:

```sh
attest verify proof/receipt.yaml --recompute --require signature,recompute,success --trust-store .github/attest/trust --offline
```

The receipt establishes the recorded checks and package identity. It does not
claim a hermetic build or an independently trusted timestamp.
