import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
export function checkAudit(audit) {
  if (
    !audit ||
    audit.error ||
    !audit.vulnerabilities ||
    typeof audit.vulnerabilities !== "object" ||
    Array.isArray(audit.vulnerabilities)
  )
    throw new Error("Dependency audit failed; release blocked");
  if (Object.keys(audit.vulnerabilities).length)
    throw new Error("Dependency advisory found; release blocked");
  return 0;
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
  checkAudit(audit);
  if (result.status !== 0)
    throw new Error("Dependency audit command failed; release blocked");
  console.log("Dependency audit: no known advisories; no exceptions.");
}
