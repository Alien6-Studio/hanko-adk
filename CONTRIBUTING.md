# Contributing

Open an issue describing the application use case before adding a language or
framework. Keep authentication protocol, product authorization and deployment
configuration separate.

Run `npm ci && npm run check` and, in `go/`, `go test -race ./... && go vet ./...`.
Changes to token acceptance must update the shared vectors and pass both
implementations. Include a packaged consumer check for packaging changes.

Use synthetic identities, endpoints and credentials in examples. Never commit
cluster configuration, customer data or secrets. Sign commits and include a
`Signed-off-by` line. Contributions are provided under Apache-2.0.
