# Hanko ADK

Integrate application authentication with Hanko using the same contracts in Go
and TypeScript. Applications keep their sessions and business authorization.

[![CI](https://github.com/Alien6-Studio/hanko-adk/actions/workflows/ci.yml/badge.svg)](https://github.com/Alien6-Studio/hanko-adk/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

| Package | Use |
| --- | --- |
| [Go](go) | JWT resource servers, Authorization Code + PKCE for CLIs, organization client |
| [TypeScript](typescript) | Auth.js, Passport/NestJS, discovery, refresh, logout and organization client |

The resource-server adapters verify Hanko-issued access tokens: signature,
issuer, audience, expiry, token class and a maximum one-hour lifetime. Verified
identity is keyed by `(iss, sub)`. `createHankoPrincipal` only normalizes claims
that your authentication framework has already verified.

This is the application client for Hanko, not a Keycloak administration SDK.
The [independent operator](https://github.com/Alien6-Studio/hankoshell-operator)
manages IAM configuration; applications use this ADK with their Hanko issuer.
Bounded-delegation exchange helpers are not included in this initial package.

## Configure

Supply runtime secrets through your application's secret mechanism:

```text
HANKO_ISSUER=https://auth.example.test/realms/example
HANKO_CLIENT_ID=example-app
HANKO_CLIENT_SECRET=<server-only secret, when required>
HANKO_AUDIENCE=example-api
```

Use the [TypeScript examples](typescript/README.md) or [Go examples](go/README.md).
Do not put client secrets in browser bundles or integration manifests.

## Develop

Use Node 22 or 24 and Go 1.27.3.

```sh
npm ci
npm run check
cd go && go test -race ./... && go vet ./...
```

Shared access-token vectors live in `go/testdata`; both implementations execute
them. The portable application manifest is [integration v1](contracts/integration-v1.schema.json).
TypeScript HTTP calls default to five seconds and at most 1 MiB per response;
redirects are refused. Go discovery and organization requests use the same
bounds by default.

## Distribution

The first public packages are being prepared. Until version tags are published,
use a reviewed source revision. Package versions are independent of the operator.
Go tags use `go/vX.Y.Z`; TypeScript tags use `typescript/vX.Y.Z`. npm publication
requires control of the `@alien6` scope and its configured trusted publisher.
Released versions must not be replaced.

See [contribution](CONTRIBUTING.md) and [security reporting](SECURITY.md).

Copyright 2026 Alien6 Studio. Licensed under Apache-2.0.
