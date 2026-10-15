# Säävirta product context

Säävirta helps electricity retailers monitor weather globally and inspect Finnish electricity fundamentals by delivery period. The product is an analytical workspace: it does not execute trades or predict prices.

The Weather desk supports deliberate location selection, hourly forecasts, daily summaries, normals and model-run comparisons. The Energy Markets Delivery desk adds national demand/generation forecasts, observed forecast revisions and completed consumption errors. Selected-point weather remains local context.

Preserve explicit provenance, null/missing values, native units, UTC interval semantics and independent source failures. Åland is an SE3 location with a Finland national comparison. Device coordinates require explicit selection and remain private unless the user chooses to save/share them.

The implementation uses TypeScript, React/vinext and Cloudflare Workers, D1, KV, Durable Objects and Cron. See [PRODUCT.md](PRODUCT.md) for design constraints, [the market guide](docs/markets/README.md) for formulas, and [operations](docs/markets/operations.md) for releases and recovery.
