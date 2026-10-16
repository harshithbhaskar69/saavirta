import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001";
assert.ok(
  ["127.0.0.1", "localhost"].includes(new URL(base).hostname),
  "Use the local built Worker; this script makes live weather requests",
);
const directory = ".impeccable/review";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const evidence = [];
try {
  for (const [device, width, height] of [
    ["desktop", 1440, 1000],
    ["mobile", 390, 844],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      reducedMotion: "reduce",
      colorScheme: "light",
      hasTouch: device === "mobile",
      isMobile: device === "mobile",
      deviceScaleFactor: 1,
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto(base);
    await expect(
      page.getByRole("button", { name: "Search anywhere", exact: true }),
    ).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: `${directory}/welcome-${device}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Choose on map", exact: true })
      .click();
    const map = page.getByRole("dialog", { name: "Choose on map" });
    await expect(map.locator(".map-surface")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await page.screenshot({
      path: `${directory}/map-${device}.png`,
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await page.getByRole("link", { name: /Rotterdam/ }).click();
    await expect(
      page.getByRole("heading", { name: "Daily summary", exact: true }),
    ).toBeVisible({ timeout: 30000 });
    const slider = page.getByRole("slider", { name: "Forecast hour" });
    await slider.focus();
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowRight");
    await expect(slider).toHaveAttribute("aria-valuenow", "1");
    await page.screenshot({
      path: `${directory}/live-${device}.png`,
      fullPage: true,
    });
    await page.locator("#hourly").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${directory}/detail-live-${device}.png` });
    await page
      .getByRole("button", { name: "Switch to dark appearance" })
      .click();
    await expect(page.locator("body")).toHaveCSS(
      "background-color",
      "rgb(18, 18, 18)",
    );
    await page.screenshot({
      path: `${directory}/overview-${device}-dark.png`,
      fullPage: true,
    });
    evidence.push({
      device,
      liveProvider: true,
      errors,
      overflow: await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    });
    await context.close();
  }
} finally {
  await browser.close();
}
await writeFile(
  `${directory}/live-browser.json`,
  JSON.stringify(evidence, null, 2),
);
console.log(JSON.stringify(evidence));
if (evidence.some((row) => row.errors.length || row.overflow))
  process.exitCode = 1;
