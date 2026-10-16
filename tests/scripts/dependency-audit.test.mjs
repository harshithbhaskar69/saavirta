import assert from "node:assert/strict";
import { test } from "node:test";
import { checkAudit } from "../../scripts/dependency-audit.mjs";

test("audit fails closed on all advisories and failed audit responses", () => {
  const audit = {
    vulnerabilities: {
      braces: {
        via: [{ url: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm" }],
      },
    },
  };
  assert.equal(checkAudit({ vulnerabilities: {} }), 0);
  assert.throws(() => checkAudit(audit));
  assert.throws(() => checkAudit({}));
  assert.throws(() => checkAudit({ error: "offline" }));
  assert.throws(() => checkAudit({ vulnerabilities: [] }));
  assert.throws(() => checkAudit(null));
  audit.vulnerabilities.braces.via[0].url = "https://example.test/new-advisory";
  assert.throws(() => checkAudit(audit));
  assert.throws(() =>
    checkAudit({ vulnerabilities: { indirect: { via: ["braces"] } } }),
  );
});
