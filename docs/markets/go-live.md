# Release readiness

Säävirta helps a retailer inspect delivery periods where national demand, renewable forecasts and local weather deserve attention. Residual load shows demand less forecast wind/solar; collected revisions show changes in the outlook; completed consumption errors compare actuals with a forecast collected about 24 hours earlier. These do not model the retailer's customers, contracted positions, imbalance costs or price causality.

Fingrid authentication and the NLS boundary are verified. Production uses real fundamentals, with no synthetic substitution. ENTSO-E prices require REST access, authenticated response validation and redistribution permission. History-dependent indicators appear only when eligible earlier snapshots exist.

Every release must pass deterministic tests, secret/dependency scans and Terraform validation, then deploy the tested Worker artifact. Verify hosted context, real market data, weather navigation, security headers and archive continuity. [Verification](verification.md) records evidence and [release gates](release-gates.md) records remaining limitations. Changes ship through the same pipeline on `main`.
