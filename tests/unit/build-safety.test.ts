import { expect, it } from "vitest";
import { unsafeRuntimeModules } from "../../build-safety";

it("rejects bundled and external build-only modules without rejecting application names", () => {
  expect(unsafeRuntimeModules([
    "/app/node_modules/braces/lib/compile.js",
    "micromatch",
    "fast-glob/out/index.js",
    "C:\\app\\node_modules\\vite-plugin-commonjs\\index.js",
    "/app/src/braces.ts",
    "./assets/braces-example.js",
    "/app/node_modules/recharts/index.js",
  ])).toEqual([
    "/app/node_modules/braces/lib/compile.js", "micromatch", "fast-glob/out/index.js",
    "C:\\app\\node_modules\\vite-plugin-commonjs\\index.js",
  ]);
});
