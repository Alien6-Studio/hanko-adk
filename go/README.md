# Hanko ADK for Go

Module: `github.com/Alien6-Studio/hanko-adk/go`. Use Go 1.27.3.
The first public version is being prepared; until then use a reviewed revision.

## Verify an access token

```go
verifier, err := hankoadk.NewVerifier(ctx, hankoadk.ResourceServerConfig{
    Issuer:   "https://auth.example.test/realms/example",
    Audience: "example-api",
}, nil)
if err != nil {
    return err
}
principal, err := verifier.Verify(ctx, rawAccessToken)
if err != nil {
    return err
}
// Map principal.Issuer and principal.Subject to your application's identity.
```

Import the module as `hankoadk`. The verifier checks RS256 signatures, exact
issuer and audience, access-token class, subject, issuance and expiry. It uses
Hanko-issued tokens; product roles and authorization remain your responsibility.

`LoadClientConfig` and `LoadResourceServerConfig` accept an environment lookup.
The `FromEnvironment` variants use the current process environment. See the
[project README](../README.md) for the `HANKO_*` configuration keys.

## Other adapters

The OAuth helpers implement Authorization Code + PKCE primitives for a CLI.
The application owns browser initiation, callback handling and token storage.
`NewOrganizationClient` accesses Hanko organization positions using your
short-lived access-token callback.

Discovery and organization requests refuse redirects and use a five-second
HTTP timeout by default. Response bodies are limited to 1 MiB. Caller contexts
can set a shorter deadline; a supplied HTTP client retains its finite timeout.
No token or client secret is persisted by the ADK.

```sh
go test -race ./...
go vet ./...
```

Go release tags are `go/vX.Y.Z`. Existing consumers of the old private module
must explicitly migrate their imports. Released module versions are immutable.
