import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fixture from "../fixtures/markets/dashboard.json" with { type: "json" };
import { forecast, baselines } from "../fixtures/weather";
import { dashboardSchema } from "../../src/features/markets/contracts";

const shared =
  "/?lat=60.1695&lon=24.9354&name=Helsinki&countryCode=FI&workspace=markets&delivery=2026-10-15";
async function mock(page: Page) {
  const now = Date.parse(fixture.generatedAt);
  await page.clock.setFixedTime(now);
  await page.route("**/api/weather**", (route) => {
    const weather = forecast("48h", undefined, now);
    weather.location.timezone = "Europe/Helsinki";
    return route.fulfill({ json: weather });
  });
  await page.route("**/api/baselines**", (route) =>
    route.fulfill({ json: baselines(undefined, now) }),
  );
  await page.route("**/api/v1/market-context", (route) => {
    const body = route.request().postDataJSON();
    const context = { ...fixture.marketContext };
    if (body.longitude < 20) {
      context.region = "aland";
      context.localBiddingZone = "SE3";
      context.relationship = "national_comparison";
    }
    if (body.latitude < 59) {
      context.geographicStatus = "outside";
      context.relationship = "unavailable";
    }
    return route.fulfill({
      json: {
        schemaVersion: "1",
        requestId: "test-context",
        marketContext: context,
      },
    });
  });
  await page.route("**/api/v1/markets/fi/dashboard", (route) => {
    const body = route.request().postDataJSON();
    const data = dashboardSchema.parse(fixture);
    if (body.days > 1) {
      const day = 86_400_000;
      data.requestedInterval.end = new Date(
        Date.parse(data.requestedInterval.end) + (body.days - 1) * day,
      ).toISOString();
      for (const s of [
        ...data.series.filter((s) => !s.id.endsWith("-now")),
        ...data.metrics,
      ]) {
        const first = [...s.intervals];
        for (let d = 1; d < body.days; d++)
          s.intervals.push(
            ...first.map((p) => ({
              ...p,
              start: new Date(Date.parse(p.start) + d * day).toISOString(),
              end: new Date(Date.parse(p.end) + d * day).toISOString(),
              value: null,
              coverage: 0,
              missingReason: "not-published",
              inputs: [],
            })),
          );
        s.quality.coverage /= body.days;
        if (s.quality.coverage > 0) s.quality.availability = "partial";
      }
    }
    if (body.longitude < 20) {
      data.marketContext.region = "aland";
      data.marketContext.localBiddingZone = "SE3";
      data.marketContext.relationship = "national_comparison";
    }
    return route.fulfill({ json: data });
  });
}
test.beforeEach(async ({ page }) => {
  await mock(page);
});

test("Delivery desk inspects one UTC interval and preserves workspace history", async ({
  page,
}) => {
  await page.goto(shared);
  await expect(
    page.getByRole("heading", { name: "Finland electricity", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Demonstration data\./)).toBeVisible();
  const demand = page.getByRole("region", { name: "Demand", exact: true });
  await expect(demand.locator(".market-legend")).toContainText(
    "Consumption forecast · Fingrid",
  );
  await demand
    .getByRole("button", { name: "About the consumption forecast" })
    .click();
  await expect(demand.locator(".info-popover")).toBeVisible();
  await expect(demand.locator(".info-popover")).toContainText("dataset 166");
  await expect(demand.locator(".info-popover")).toContainText(
    "does not forecast your customers' demand",
  );
  await page.keyboard.press("Escape");
  const slider = page.getByRole("slider", {
    name: "Delivery period",
    exact: true,
  });
  await slider.focus();
  await slider.press("ArrowRight");
  await expect(slider).toHaveValue("1");
  await expect(page.locator(".period-inspector h3")).toContainText("00:15");
  await expect(page.locator(".market-readings")).toContainText("Unavailable");
  await page.getByRole("button", { name: /^Lowest:/ }).click();
  await expect(slider).toHaveValue("0");
  await page.getByRole("button", { name: "Weather", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Daily summary", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Finland electricity", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "1 hour", exact: true }).click();
  await expect(page).toHaveURL(/resolution=PT60M/);
  await page
    .getByText("Accessible delivery interval table", { exact: true })
    .click();
  await expect(
    page.getByRole("table", { name: /Finland market values/ }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  expect((await download).suggestedFilename()).toContain("-demo.csv");
});

test("Aland is a national comparison and an outside point returns to weather", async ({
  page,
}) => {
  await page.goto(
    shared.replace("24.9354", "19.9348").replace("60.1695", "60.0973"),
  );
  await expect(page.getByText(/Åland belongs to SE3/)).toBeVisible();
  await page.goto(shared.replace("60.1695", "51.9"));
  await expect(
    page.getByText(/outside the supported Finland area/),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Daily summary", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Energy Markets", exact: true }),
  ).toHaveCount(0);
  await expect(page).not.toHaveURL(/workspace=markets/);
  await page.evaluate((href) => {
    history.pushState(null, "", href);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, shared);
  await expect(
    page.getByRole("heading", { name: "Finland electricity", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/outside the supported Finland area/),
  ).toHaveCount(0);
});

test("private device coordinates stay in POST bodies across workspace navigation", async ({
  page,
  context,
}) => {
  const point = { latitude: 60.1695, longitude: 24.9354 };
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation(point);
  const requests: import("@playwright/test").Request[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/")) requests.push(request);
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Use my location", exact: true })
    .click();
  await page.getByRole("button", { name: /Use precise location/ }).click();
  await page
    .getByRole("button", { name: "Energy Markets", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Finland electricity", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Weather", exact: true }).click();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Finland electricity", exact: true }),
  ).toBeVisible();
  expect(requests.length).toBeGreaterThanOrEqual(2);
  for (const request of requests) {
    expect(request.method()).toBe("POST");
    expect(request.postDataJSON()).toMatchObject(point);
    expect(request.url()).not.toContain("60.1695");
  }
  expect(page.url()).not.toMatch(/[?&](lat|lon)=/);
  expect(
    await page.evaluate(() => localStorage.getItem("saasignal:point")),
  ).toBeNull();
});

test("partial and stale series remain usable and provider outages can retry", async ({
  page,
}) => {
  let failed = true;
  await page.route("**/api/v1/markets/fi/dashboard", (route) => {
    if (failed)
      return route.fulfill({
        status: 503,
        json: {
          type: "about:blank",
          status: 503,
          title: "Market collection is warming",
          code: "market-warming",
          requestId: "test",
        },
      });
    const data = structuredClone(fixture);
    data.series[3].quality.freshness = "stale";
    data.metrics[0].quality.freshness = "stale";
    for (const point of data.metrics[0].intervals) {
      point.inputs[1].collectedAt = "2026-10-15T08:43:00Z";
    }
    return route.fulfill({ json: data });
  });
  await page.goto(shared);
  await expect(page.getByRole("alert")).toContainText("warming");
  failed = false;
  await page
    .getByRole("button", { name: "Retry markets", exact: true })
    .click();
  await expect(page.locator(".market-legend").first()).toContainText("stale");
  await expect(
    page.getByRole("slider", { name: "Delivery period", exact: true }),
  ).toBeVisible();
  const residual = page.locator(".market-metrics article").first();
  await expect(
    residual.getByText("Stale inputs", { exact: true }),
  ).toBeVisible();
  await residual
    .getByRole("button", {
      name: "Methodology for Forecast residual load",
      exact: true,
    })
    .click();
  await expect(residual.locator(".market-input-collections time")).toHaveCount(
    2,
  );
  const windCollection = residual
    .locator(".market-input-collections > div")
    .filter({ hasText: "Wind forecast" });
  await expect(windCollection.locator("time")).toHaveAttribute(
    "datetime",
    "2026-10-15T08:43:00Z",
  );
  const sharedCollection = residual
    .locator(".market-input-collections > div")
    .filter({ hasText: "Consumption forecast" });
  await expect(sharedCollection).toContainText("Solar forecast");
  await expect(sharedCollection.locator("time")).toHaveAttribute(
    "datetime",
    "2026-10-15T08:58:00Z",
  );
});

test("market layouts in both themes are accessible, responsive and reduced-motion safe", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(shared);
  await expect(
    page.getByRole("heading", { name: "Finland electricity", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  for (const theme of ["light", "dark"]) {
    if (theme === "dark")
      await page
        .getByRole("button", { name: "Switch to dark appearance" })
        .click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(axe.violations).toEqual([]);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `.impeccable/review/markets-${testInfo.project.name}-${theme}.png`,
      fullPage: true,
      scale: "css",
    });
  }
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  expect(errors).toEqual([]);
});

test("all charts share readable calendar dates across three delivery days", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto(shared);
  await page.getByRole("button", { name: "Days 1 day", exact: true }).click();
  await page
    .getByRole("group", { name: "Delivery days" })
    .getByRole("button", { name: "3 days", exact: true })
    .click();
  await expect(page).toHaveURL(/marketDays=3/);
  const axes = page.locator(".market-desk .recharts-xAxis-tick-labels");
  await expect(axes).toHaveCount(7);
  for (let i = 0; i < 7; i++)
    await expect(
      axes.nth(i).locator(".recharts-cartesian-axis-tick-value"),
    ).toHaveText(["15 Oct", "16 Oct", "17 Oct", "18 Oct"]);
  for (const chart of await page
    .locator(".market-desk .recharts-surface")
    .all()) {
    const date = await chart
      .locator(
        ".recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-value",
      )
      .first()
      .boundingBox();
    const value = await chart
      .locator(
        ".recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value",
      )
      .first()
      .boundingBox();
    expect(date!.y - (value!.y + value!.height)).toBeGreaterThanOrEqual(8);
  }
  await expect(page.getByRole("contentinfo")).toBeAttached();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: `.impeccable/review/markets-days-${testInfo.project.name}.png`,
    fullPage: true,
    scale: "css",
  });
});

test("Days uses an in-page list and metric explanations disclose independently", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(shared);
  await expect(
    page.getByRole("heading", { name: "Finland electricity", exact: true }),
  ).toBeVisible();
  const days = page.getByRole("button", { name: /^Days \d/ });
  const options = page.getByRole("group", {
    name: "Delivery days",
    exact: true,
  });
  await expect(page.getByRole("combobox", { name: "Days" })).toHaveCount(0);
  await days.focus();
  await days.press("Space");
  await expect(options).toBeVisible();
  await expect(
    options.getByRole("button", { name: "1 day", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(
    options.getByRole("button", { name: "2 days", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(options).toBeHidden();
  await expect(days).toBeFocused();
  await expect(page).toHaveURL(/marketDays=2/);
  await days.click();
  await page.keyboard.press("Escape");
  await expect(options).toBeHidden();
  await expect(days).toBeFocused();

  const metric = page.locator(".market-metrics article").filter({
    has: page.getByRole("heading", {
      name: "Forecast residual load",
      exact: true,
    }),
  });
  const details = metric.getByRole("button", {
    name: "Methodology for Forecast residual load",
    exact: true,
  });
  await expect(metric.locator(".market-metric-value")).toBeVisible();
  await expect(metric.locator(".market-metric-summary")).toHaveText(
    "Demand remaining after forecast wind and solar generation.",
  );
  await expect(metric.getByText(/Updated/)).toHaveCount(0);
  await expect(details).toHaveAttribute("aria-expanded", "false");
  await expect(metric.locator(".market-metric-details")).toHaveCount(0);
  await metric.scrollIntoViewIfNeeded();
  await page.locator(".market-metrics").screenshot({
    path: testInfo.outputPath("metric-disclosures-collapsed.png"),
  });
  const about = metric.getByRole("button", {
    name: "About Forecast residual load",
    exact: true,
  });
  const explanation = metric.locator(".info-popover");
  await about.focus();
  await about.press("Space");
  await expect(explanation).toBeVisible();
  await expect(
    explanation.getByRole("heading", { name: "What is residual load?" }),
  ).toBeVisible();
  await expect(explanation).toContainText("Not net imports");
  const bounds = await explanation.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("metric-info.png") });
  await page.keyboard.press("Escape");
  await expect(explanation).toBeHidden();
  await expect(about).toBeFocused();
  await details.focus();
  await details.press("Space");
  await expect(details).toHaveAttribute("aria-expanded", "true");
  await expect(metric.locator(".market-metric-details")).toContainText(
    "Demand forecast − wind forecast − solar forecast",
  );
  await expect(metric.locator(".market-metric-details")).toContainText(
    "Coverage: 50% of selected delivery periods",
  );
  await expect(metric.locator(".market-input-collections time")).toHaveCount(1);
  await expect(metric.locator(".market-input-collections")).toContainText(
    "Consumption forecast · Wind forecast · Solar forecast",
  );
  await expect(metric.locator(".market-metric-details")).toContainText(
    "Source: Synthetic demonstration data",
  );
  await expect(
    page.locator('.market-metric-trigger[aria-expanded="true"]'),
  ).toHaveCount(1);
  await page.locator(".market-metrics").screenshot({
    path: testInfo.outputPath("metric-disclosures-expanded.png"),
  });
  await details.press("Enter");
  await expect(details).toBeFocused();
  await expect(metric.locator(".market-metric-details")).toHaveCount(0);

  const percent = page.locator(".market-metrics article").filter({
    has: page.getByRole("heading", {
      name: "Consumption error (%)",
      exact: true,
    }),
  });
  await percent
    .getByRole("button", {
      name: "Methodology for Consumption error (%)",
      exact: true,
    })
    .click();
  await expect(percent.locator(".market-metric-formula")).toHaveText(
    "100 × (actual demand − earlier forecast) ÷ earlier forecast",
  );
  await expect(percent.locator(".market-metric-value")).toHaveText(
    "Collecting history…",
  );
  const history = percent.locator(".text-shimmer");
  await expect(history).toHaveCSS("font-size", "23px");
  await expect(history).toHaveCSS("animation-name", "none");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(history).toHaveCSS("animation-name", "shimmer");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(percent.getByText("Fresh inputs", { exact: true })).toHaveCount(
    0,
  );
  const revision = page.locator(".market-metrics article").filter({
    has: page.getByRole("heading", {
      name: "Wind forecast change over one hour",
      exact: true,
    }),
  });
  await revision
    .getByRole("button", {
      name: "Methodology for Wind forecast change over one hour",
      exact: true,
    })
    .click();
  await expect(revision.locator(".market-metric-formula")).toHaveText(
    "Latest forecast − earlier forecast",
  );

  await page.getByLabel("Delivery date", { exact: true }).fill("2026-10-17");
  await expect(days).toHaveText("1 day");
  await days.click();
  await expect(options.getByRole("button")).toHaveCount(1);
  await expect(
    options.getByRole("button", { name: "1 day", exact: true }),
  ).toBeVisible();
});
