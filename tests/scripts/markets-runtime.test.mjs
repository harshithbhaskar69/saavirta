import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";

test("D1 preserves snapshots, atomic writes, recovery and collector scheduling", async () => {
  const directory = mkdtempSync(join(tmpdir(), "saavirta-markets-"));
  const compiled = await build({
    entryPoints: ["tests/runtime/markets.ts"],
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
    external: ["cloudflare:workers"],
  });
  const options = convertV4MiniflareOptions({
    workers: [
      {
        name: "markets-test",
        modules: true,
        script: compiled.outputFiles[0].text,
        compatibilityDate: "2026-10-13",
        outboundService: () => new globalThis.Response("provider fixture"),
        d1Databases: { MARKET_DB: "market-db" },
        durableObjects: {
          COLLECTOR: { className: "TestCollector", useSQLite: true },
        },
        bindings: { COLLECTOR_ENABLED: "true", MARKET_MODE: "live" },
      },
    ],
    d1Persist: directory,
    durableObjectsPersist: directory,
  });
  options.resourcePersistencePath = directory;
  let mf = new Miniflare(options);
  const json = async (path, body) =>
    mf.dispatchFetch(
      `http://markets${path}`,
      body ? { method: "POST", body: JSON.stringify(body) } : undefined,
    );
  const start = Date.parse("2026-10-15T09:00Z"),
    cutoff = start - 86400000;
  const batch = (collected, value, offset = 0) => ({
    dataset: "166",
    snapshotId: `snapshot-${collected}`,
    collectedAt: new Date(collected).toISOString(),
    publishedAt: null,
    revision: null,
    intervals: [
      {
        start: new Date(start + offset).toISOString(),
        end: new Date(start + offset + 900000).toISOString(),
        value,
        coverage: 1,
        provisional: false,
        missingReason: null,
        inputs: [],
      },
    ],
  });
  try {
    // Exercise the native Workers fetch receiver, which a mocked function cannot check.
    assert.equal(await (await json("/provider")).text(), "provider fixture");
    let db = await mf.getD1Database("MARKET_DB");
    await db.exec(
      readFileSync("migrations/0001_markets.sql", "utf8").replaceAll("\n", " "),
    );
    for (const b of [batch(cutoff - 900000, 1000), batch(cutoff + 1, 1100)])
      assert.equal((await json("/save", b)).status, 200);
    const requests = [{ cutoff, start, end: start + 900000 }];
    let baseline = await (await json("/baselines", requests)).json();
    assert.equal(baseline.length, 1);
    assert.equal(baseline[0].intervals[0].value, 1000);
    // The latest eligible snapshot lacks this period: do not substitute an older forecast.
    assert.equal(
      (await json("/save", batch(cutoff, 2000, 3600000))).status,
      200,
    );
    baseline = await (await json("/baselines", requests)).json();
    assert.equal(baseline[0].collectedAt, new Date(cutoff).toISOString());
    assert.equal(baseline[0].intervals.length, 0);
    await db.exec(
      "CREATE TRIGGER reject_check BEFORE UPDATE ON checks BEGIN SELECT RAISE(ABORT,'synthetic failure'); END;",
    );
    assert.equal((await json("/save", batch(start, 9999))).status, 500);
    assert.equal((await (await json("/")).json()).intervals[0].value, 1100);
    await db.exec("DROP TRIGGER reject_check;");
    const collected = await (await json("/collector")).json();
    assert.ok(collected.alarm);
    assert.ok(collected.jobs.length >= 9);
    const due = collected.jobs.find((j) => j.dataset === "193" && !j.date).due;
    assert.ok(due > Date.now());
    await mf.dispose();
    mf = new Miniflare(options);
    db = await mf.getD1Database("MARKET_DB");
    assert.equal((await (await json("/")).json()).intervals[0].value, 1100);
    const state = await (await json("/state")).json();
    assert.equal(
      state.jobs.find((j) => j.dataset === "193" && !j.date).due,
      due,
    );
    // A portable logical copy restores all three tables independently of local persistence.
    const copy = new Miniflare(
      convertV4MiniflareOptions({
        workers: [
          {
            name: "restore",
            modules: true,
            script:
              "export default { fetch() { return new Response('ok'); } };",
            d1Databases: { DB: "restored" },
            compatibilityDate: "2026-10-13",
          },
        ],
      }),
    );
    try {
      const target = await copy.getD1Database("DB");
      await target.exec(
        readFileSync("migrations/0001_markets.sql", "utf8").replaceAll(
          "\n",
          " ",
        ),
      );
      for (const table of ["intervals", "snapshots", "checks"]) {
        const { results } = await db.prepare(`SELECT * FROM ${table}`).all();
        for (const row of results)
          await target
            .prepare(
              `INSERT INTO ${table} (${Object.keys(row).join(",")}) VALUES (${Object.keys(
                row,
              )
                .map(() => "?")
                .join(",")})`,
            )
            .bind(...Object.values(row))
            .run();
        assert.deepEqual(
          (await target.prepare(`SELECT * FROM ${table}`).all()).results,
          results,
        );
      }
    } finally {
      await copy.dispose();
    }
  } finally {
    await mf.dispose();
    rmSync(directory, { recursive: true, force: true });
  }
});
