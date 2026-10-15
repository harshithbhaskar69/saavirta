# Maintenance workflow

1. Identify affected callers, contracts, storage and user-facing behavior.
2. Keep provider validation and analytics on the server; retain the existing Zod contracts.
3. Verify changes with appropriate unit tests and workerd checks. Run desktop/mobile E2E for application changes.
4. Apply additive D1 schema changes and append-only Durable Object migration tags.
5. Build without credentials. Release the tested Worker artifact through the serialized production workflow.
6. Check hosted data freshness, coverage, privacy and archive continuity after deployment.

[Product](PRODUCT.md) · [Market semantics](docs/markets/README.md) · [Operations](docs/markets/operations.md) · [Release gates](docs/markets/release-gates.md)
