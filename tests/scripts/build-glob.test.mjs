import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";

test("the pinned dynamic-import plugin resolves its supported globs without braces", async () => {
  const require = createRequire(import.meta.url);
  const plugin = createRequire(require.resolve("vite-plugin-dynamic-import"));
  const glob = plugin("fast-glob");
  assert.match(
    plugin.resolve("fast-glob"),
    /tooling[/\\]build-glob[/\\]index.cjs$/,
  );
  const cwd = await mkdtemp(join(tmpdir(), "saavirta-glob-"));
  try {
    await mkdir(join(cwd, "nested"));
    for (const name of [
      "one.js",
      "two.ts",
      "ignored.md",
      ".hidden.js",
      "nested/index.ts",
    ])
      await writeFile(join(cwd, name), "");
    assert.deepEqual(
      glob.sync(["*.{js,ts}", "nested/index.{js,ts}"], { cwd }).sort(),
      ["nested/index.ts", "one.js", "two.ts"],
    );
    assert.deepEqual(glob.sync(["**/*.ts", "!nested/**"], { cwd }), ["two.ts"]);
    assert.deepEqual(glob.sync("missing/*.js", { cwd }), []);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
