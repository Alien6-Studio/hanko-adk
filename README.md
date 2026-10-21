# HankoShell TypeScript ADK

Application-side Hanko adapters for Node 22 and 24. The first public version of
`@alien6/hankoshell-typescript-adk` is being prepared; no npm release is claimed yet.

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
import { loadHankoResourceServerConfig, createHankoPrincipal } from "@alien6/hankoshell-typescript-adk";
import { createHankoJwtStrategyOptions } from "@alien6/hankoshell-typescript-adk/passport";

const config = loadHankoResourceServerConfig(process.env);
const strategy = new Strategy(createHankoJwtStrategyOptions(config), (claims, done) => {
  try { done(null, createHankoPrincipal(claims, config)); }
  catch (error) { done(error); }
});
```

Passport performs signature verification before the callback. Calling
`createHankoPrincipal` by itself does not authenticate a token. Install the
optional `passport-jwt` peer for this entry point.

## Refresh, logout and organization

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
Applications retain their sessions and business authorization. IAM administration
belongs to the [operator](https://github.com/Alien6-Studio/hankoshell-operator).

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
