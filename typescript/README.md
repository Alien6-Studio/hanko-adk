# Hanko ADK for TypeScript

Application-side Hanko adapters for Node 22 and 24. The first public version of
`@alien6/hanko-adk` is being prepared; no npm release is claimed yet.

## Auth.js

```ts
import NextAuth from "next-auth";
import { loadHankoClientConfig } from "@alien6/hanko-adk";
import { createHankoAuthJsProvider } from "@alien6/hanko-adk/authjs";

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
import { loadHankoResourceServerConfig, createHankoPrincipal } from "@alien6/hanko-adk";
import { createHankoJwtStrategyOptions } from "@alien6/hanko-adk/passport";

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

The public package uses ESM and typed exports. See the [project README](../README.md)
for the environment contract, contribution and release status.
