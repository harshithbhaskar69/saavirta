import assert from "node:assert/strict";
import { test } from "node:test";
import { checkAudit } from "../../scripts/dependency-audit.mjs";

test("audit fails closed on unknown advisories, audit failures and expired exceptions", () => {
  const audit = {
    vulnerabilities: {
      braces: {
        via: [{ url: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm" }],
      },
    },
  };
  assert.equal(checkAudit(audit, Date.parse("2026-10-15")), 1);
  assert.throws(() => checkAudit(audit, Date.parse("2026-11-01")));
  assert.throws(() => checkAudit({}));
  assert.throws(() => checkAudit({ error: "offline" }));
  audit.vulnerabilities.braces.via[0].url = "https://example.test/new-advisory";
  assert.throws(() => checkAudit(audit, Date.parse("2026-10-15")));
});
