import assert from "node:assert/strict";
import { test } from "node:test";
import { setTimeout } from "node:timers/promises";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";

for (const section of ["forecast", "baselines", "uncertainty"]) {
  test(`${section} recovers after an earlier request context ends`, async () => {
    const compiled = await build({
      entryPoints: ["tests/runtime/weather.ts"],
      bundle: true,
      write: false,
      format: "esm",
      platform: "browser",
    });
    const mf = new Miniflare(
      convertV4MiniflareOptions({
        workers: [
          {
            name: "weather-test",
            modules: true,
            script: compiled.outputFiles[0].text,
            compatibilityDate: "2026-10-13",
          },
        ],
      }),
    );
    try {
      const url = new globalThis.URL(`/${section}`, await mf.ready);
      const abandoned = await globalThis.fetch(`${url}?abandon`);
      assert.equal(await abandoned.text(), "Owner ended");
      await setTimeout(50);
      // Use HTTP so workerd ends the previous invocation before the next one.
      const response = await globalThis.fetch(url, {
        signal: globalThis.AbortSignal.timeout(2000),
      });
      assert.equal(response.status, 200);
      const result = await response.json();
      if (section === "forecast") assert.equal(result.hourly.length, 48);
      else if (section === "uncertainty") {
        assert.equal(result.memberCount, 51);
        assert.equal(result.hourly.length, 48);
        assert.equal(result.source.calibrated, false);
      } else {
        assert.ok(result.normals);
        assert.ok(result.revision);
      }
    } finally {
      await mf.dispose();
    }
  });
}
