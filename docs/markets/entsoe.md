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

## Remaining release gate

REST access is verified. Permission for storing and displaying prices is not.
`ENTSOE_CONTRACT_VERIFIED=true` therefore leaves `PRICE_REDISPLAY_ALLOWED=false`
and `PRICE_EXPORT_ALLOWED=false`. The collector makes no scheduled price
requests, and the dashboard returns unavailable prices rather than zero values.

ENTSO-E's [terms, section 3.1](https://transparencyplatform.zendesk.com/hc/article_attachments/40921869376401)
require respecting the primary owner's rights. Day-ahead prices (12.1.d) are
absent from the [free-reuse list checked on 17 October 2026](https://transparencyplatform.zendesk.com/hc/en-us/article_attachments/40921869379729).
An API token alone is not evidence of caching, display or export permission.

Ask ENTSO-E support to confirm the relevant primary owner and permitted use of
FI day-ahead prices in a non-commercial, invite-only application, including
30-day server caching and display to invited users. Request export permission
separately if needed. Keep the response privately. Once confirmed, enable only
the permitted [Infisical settings](secrets.md) and redeploy; no adapter rewrite
is required.

References: [official REST integration guide](https://transparencyplatform.zendesk.com/hc/en-us/articles/15692855254548-Sitemap-for-Restful-API-Integration),
[response time zones](https://transparencyplatform.zendesk.com/hc/en-us/articles/12786431986964-Response-Time-Zone),
[A01/A03 curves](https://transparencyplatform.zendesk.com/hc/en-us/articles/30262342482961-CurveType-A01-vs-CurveType-A03).
