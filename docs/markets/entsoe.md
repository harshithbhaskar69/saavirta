# ENTSO-E day-ahead prices

The Worker uses `ENTSOE_API_TOKEN` from Infisical prod. Only the scheduled market
collector can call the provider; browser/API requests read local market data.
The token never enters source, Terraform inputs, request logs or client bundles.

Authenticated checks on 17 October 2026 verified A44 with Finland
`10YFI-1--------U` as both domains and `contract_MarketAgreement.type=A01`.
The adapter decoded current quarter-hour A03 blocks, hourly history and an
unpublished date's no-data acknowledgement. Prices use EUR/MWh. Responses can
extend beyond the requested interval; the dashboard selects UTC periods within
the requested Helsinki delivery days. Unknown publication times stay null.
[Fixture provenance](../../tests/fixtures/markets/providers/README.md) records
the observed coverage; committed fixtures replace every price amount.

## Production permissions

On 17 October 2026, the operator confirmed that reuse permission had been
granted and authorized activation of the gated functionality for this
non-commercial, invite-only deployment. Production uses
`ENTSOE_CONTRACT_VERIFIED=true`, `PRICE_REDISPLAY_ALLOWED=true` and
`PRICE_EXPORT_ALLOWED=true`. The scheduled collector stores published FI
prices in D1 with 30-day retention; the dashboard displays them and includes
them in CSV exports. Unpublished periods remain gaps, never zero prices.

The confirmation is operator-reported; private approval correspondence is not
included in the repository. This deployment's permission is not a licence grant
to other users of the source code.

ENTSO-E's [terms, section 3.1](https://transparencyplatform.zendesk.com/hc/article_attachments/40921869376401)
require respecting the primary owner's rights. Day-ahead prices (12.1.d) are
absent from the [free-reuse list checked on 17 October 2026](https://transparencyplatform.zendesk.com/hc/en-us/article_attachments/40921869379729).
An API token alone is not evidence of caching, display or export permission.

Keep the approval privately and review its scope before changing the audience
or use. New deployments must obtain their own permission before enabling the
[Infisical settings](secrets.md); both permission switches still default to
`false`. To suspend price collection and display, set both to `false` and
redeploy. Set only `PRICE_EXPORT_ALLOWED=false` to disable CSV price export.

References: [official REST integration guide](https://transparencyplatform.zendesk.com/hc/en-us/articles/15692855254548-Sitemap-for-Restful-API-Integration),
[response time zones](https://transparencyplatform.zendesk.com/hc/en-us/articles/12786431986964-Response-Time-Zone),
[A01/A03 curves](https://transparencyplatform.zendesk.com/hc/en-us/articles/30262342482961-CurveType-A01-vs-CurveType-A03).
