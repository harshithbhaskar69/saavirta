import assert from "node:assert/strict";
import { test } from "node:test";
import { request, runtimeSecrets } from "../../scripts/cloud-auth.mjs";

test("cloud API failures never include response bodies or authentication material", async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () =>
    new globalThis.Response("sensitive provider details", { status: 401 });
  try {
    await assert.rejects(request("https://api.example.test", "test-token"), {
      message: "Cloud API request failed (HTTP 401)",
    });
    await assert.rejects(request("https://api.example.test", "bad\nheader"), {
      message: "Invalid authentication configuration",
    });
  } finally {
    globalThis.fetch = previous;
  }
});

test("only provider credentials reach Worker bindings", () => {
  const input = {
    FINGRID_API_KEY: "test-fingrid",
    ENTSOE_TOKEN: "test-entsoe",
    CLOUDFLARE_API_TOKEN: "must-stay-in-deployer",
    NLS_API_KEY: "offline-only",
    ACCESS_CLIENT_SECRET: "deployment-probe-only",
  };
  assert.deepEqual(runtimeSecrets(input), {
    FINGRID_API_KEY: "test-fingrid",
    ENTSOE_TOKEN: "test-entsoe",
  });
  assert.deepEqual(
    runtimeSecrets({ FINGRID_API_KEY: "rotated", ENTSOE_TOKEN: "" }),
    { FINGRID_API_KEY: "rotated" },
  );
});
