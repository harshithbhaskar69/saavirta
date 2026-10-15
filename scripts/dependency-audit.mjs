import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
// This build-only exception expires; build-safety.ts separately excludes the package from every runtime bundle.
const accepted = "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm";
export function checkAudit(audit, now = Date.now()) {
  if (audit.error || !audit.vulnerabilities)
    throw new Error("Dependency audit failed; release blocked");
  const findings = Object.values(audit.vulnerabilities).flatMap((v) =>
    v.via.filter((item) => typeof item !== "string"),
  );
  const unexpected = findings.filter(
    (v) => v.url !== accepted || now >= Date.parse("2026-11-01"),
  );
  if (unexpected.length)
    throw new Error(
      "Unaccepted or expired dependency advisory; release blocked",
    );
  return findings.length;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const result = spawnSync("npm", ["audit", "--json"], { encoding: "utf8" });
  let audit;
  try {
    audit = JSON.parse(result.stdout);
  } catch {
    throw new Error("Dependency audit did not return valid results");
  }
  const count = checkAudit(audit);
  console.log(
    `Dependency audit: ${count} known build-only advisory; no other advisories. Exception expires 2026-11-01.`,
  );
}
