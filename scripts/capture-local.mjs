import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001";
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
    await page
      .getByRole("heading", { name: "The outlook for the hours ahead." })
      .waitFor();
    await page.locator(".map-surface[data-ready=true]").waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: `${directory}/welcome-${device}.png`,
      fullPage: true,
    });
    await page.getByRole("link", { name: /Rotterdam/ }).click();
    await page.getByRole("heading", { name: "Weather drivers" }).waitFor();
    await page.locator(".map-surface").scrollIntoViewIfNeeded();
    await page.locator(".map-surface[data-ready=true]").waitFor();
    await page.waitForTimeout(200);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `${directory}/live-${device}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Expand temperature chart" })
      .click();
    await page.getByRole("button", { name: "Compare", exact: true }).click();
    await page.getByRole("slider").waitFor();
    await page.screenshot({
      path: `${directory}/detail-live-${device}.png`,
      fullPage: true,
    });
    const cursors = await page
      .locator(".recharts-reference-line line")
      .evaluateAll((lines) =>
        lines.map((line) => Number(line.getAttribute("x1"))),
      );
    const tickColor = await page
      .locator("text.recharts-cartesian-axis-tick-value")
      .first()
      .evaluate((element) => getComputedStyle(element).fill);
    await page.getByRole("button", { name: "Close hourly weather" }).click();
    await page.getByRole("link", { name: "Map", exact: true }).click();
    await page
      .locator(".geo-map.expanded .map-surface[data-ready=true]")
      .waitFor();
    await page.screenshot({
      path: `${directory}/map-${device}.png`,
      fullPage: true,
    });
    await page.goto(
      `${base}/?lat=12.3119&lon=76.6581&name=Mysuru&region=Karnataka&country=India&countryCode=IN&view=map`,
    );
    await page.getByRole("heading", { name: "Mysuru", exact: true }).waitFor();
    await page
      .locator(".geo-map.expanded .map-surface[data-ready=true]")
      .waitFor();
    await page
      .getByRole("button", { name: "Open forecast", exact: true })
      .waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: `${directory}/mysuru-${device}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Switch to dark appearance" })
      .click();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: `${directory}/mysuru-${device}-dark.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Open forecast", exact: true })
      .click();
    await page.getByRole("heading", { name: "Weather drivers" }).waitFor();
    await page.screenshot({
      path: `${directory}/overview-${device}-dark.png`,
      fullPage: true,
    });
    evidence.push({
      device,
      liveProvider: true,
      errors,
      sharedCursorAligned:
        cursors.length === 2 && Math.abs(cursors[0] - cursors[1]) < 0.5,
      tickColor,
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
if (
  evidence.some(
    (row) => row.errors.length || row.overflow || !row.sharedCursorAligned,
  )
)
  process.exitCode = 1;
