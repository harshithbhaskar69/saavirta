import { test, expect } from "@playwright/test";

test("uncertainty API rejects invalid windows and oversized private requests", async ({
  request,
}) => {
  for (const query of [
    "lat=60&lon=25&horizon=48h",
    "lat=60&lon=25&horizon=48h&start=0",
    "lat=60&lon=25&horizon=48h&start=1&start=2",
    "lat=100&lon=25&horizon=48h&start=1",
  ]) {
    const response = await request.get(`/api/uncertainty?${query}`);
    expect(response.status()).toBe(400);
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect((await response.json()).error.requestId).toBeTruthy();
  }
  const response = await request.post("/api/uncertainty", {
    data: { latitude: 60, longitude: 25, horizon: "48h", start: "invalid" },
  });
  expect(response.status()).toBe(400);
  const oversized = await request.post("/api/uncertainty", {
    data: { padding: "x".repeat(600) },
  });
  expect(oversized.status()).toBe(400);
});

test("built HTML uses unique script nonces, private caching and a working CSP", async ({
  page,
  request,
}) => {
  test.skip(
    !process.env.CI && !process.env.PLAYWRIGHT_BASE_URL,
    "Run against the built Worker, not Vite's development server",
  );
  const nonces = new Set<string>();
  for (let i = 0; i < 2; i++) {
    const response = await request.get("/", {
      headers: {
        "Content-Security-Policy": "script-src 'nonce-client-controlled'",
      },
    });
    expect(response.status()).toBe(200);
    const headers = response.headers();
    expect(headers["cache-control"]).toBe("private, no-store");
    expect(headers["cloudflare-cdn-cache-control"]).toBe("no-store");
    const policy = headers["content-security-policy"];
    const nonce = policy.match(/'nonce-([a-f0-9]{32})'/)?.[1];
    expect(nonce).toBeTruthy();
    expect(policy).not.toContain("unsafe-eval");
    expect(policy).not.toContain("client-controlled");
    nonces.add(nonce!);
    const scripts = [...(await response.text()).matchAll(/<script\b([^>]*)>/g)];
    expect(scripts.length).toBeGreaterThan(0);
    for (const [, attributes] of scripts)
      expect(attributes).toContain(`nonce="${nonce}"`);
  }
  expect(nonces.size).toBe(2);
  const violations: string[] = [];
  page.on("console", (message) => {
    if (/violates.*Content Security Policy/i.test(message.text()))
      violations.push(message.text());
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Switch to dark appearance" }).click();
  await expect(
    page.getByRole("button", { name: "Switch to light appearance" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Choose on map", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Choose on map" }).locator(".map-surface"),
  ).toHaveAttribute("data-ready", "true");
  expect(violations).toEqual([]);
});
