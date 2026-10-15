import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stripTypeScriptTypes } from "node:module";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";

test("provider budget is atomic, persistent, and separate from public API traffic", async () => {
  const directory = mkdtempSync(join(tmpdir(), "saavirta-budget-"));
  const script =
    "Date.now = () => 1792062000000;\n" +
    stripTypeScriptTypes(readFileSync("src/lib/provider-budget.ts", "utf8")) +
    `
    export default { async fetch(request, env) {
      const key = new URL(request.url).pathname === '/api' ? 'api' : 'weather';
      const allowed = await env.BUDGET.getByName(key).reserve(key, key === 'weather' ? 30 : 1);
      return new Response(String(allowed));
    }};`;
  const options = convertV4MiniflareOptions({
    workers: [
      {
        name: "budget-test",
        modules: true,
        script,
        compatibilityDate: "2026-10-13",
        durableObjects: {
          BUDGET: { className: "ProviderBudget", useSQLite: true },
        },
      },
    ],
    durableObjectsPersist: directory,
  });
  options.resourcePersistencePath = directory;
  let mf = new Miniflare(options);
  try {
    const results = await Promise.all(
      Array.from({ length: 6 }, async () =>
        (await mf.dispatchFetch("http://budget/weather")).text(),
      ),
    );
    assert.equal(results.filter((r) => r === "true").length, 4);
    assert.equal(
      await (await mf.dispatchFetch("http://budget/api")).text(),
      "true",
    );
    await mf.dispose();
    mf = new Miniflare(options);
    assert.equal(
      await (await mf.dispatchFetch("http://budget/weather")).text(),
      "false",
    );
  } finally {
    await mf.dispose();
    rmSync(directory, { recursive: true, force: true });
  }
});
