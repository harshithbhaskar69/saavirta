import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { baselines, forecast, point } from "../fixtures/weather";
import type { Horizon } from "../../src/features/weather/types";
import { localClock } from "../../src/lib/time";
const shared =
  "/?lat=51.9225&lon=4.4792&name=Rotterdam&country=Netherlands&countryCode=NL&horizon=48h";
async function mockWeather(page: Page) {
  await page.route("**/api/v1/market-context", (route) =>
    route.fulfill({
      json: {
        schemaVersion: "1",
        requestId: "weather-only-fixture",
        marketContext: {
          geographicStatus: "outside",
          region: null,
          localBiddingZone: null,
          workspaceMarket: "FI",
          relationship: "unavailable",
          boundaryVersion: "weather-test-fixture",
          demonstration: false,
        },
      },
    }),
  );
  await page.route("**/api/weather**", async (route) => {
    const request = route.request(),
      params = new URL(request.url()).searchParams,
      body = request.method() === "POST" ? request.postDataJSON() : null;
    const result = forecast(
      (body?.horizon ?? params.get("horizon") ?? "48h") as Horizon,
      {
        latitude: Number(body?.latitude ?? params.get("lat")),
        longitude: Number(body?.longitude ?? params.get("lon")),
      },
    );
    await route.fulfill({ json: result });
  });
  await page.route("**/api/baselines**", async (route) => {
    const params = new URL(route.request().url()).searchParams;
    await route.fulfill({
      json: baselines({
        latitude: Number(params.get("lat") ?? point.latitude),
        longitude: Number(params.get("lon") ?? point.longitude),
      }),
    });
  });
  await page.route("**/api/geocode**", (route) =>
    route.fulfill({
      json: {
        places: [
          {
            name: "Sydney",
            region: "New South Wales",
            country: "Australia",
            countryCode: "AU",
            latitude: -33.8688,
            longitude: 151.2093,
          },
        ],
      },
    }),
  );
}
test.beforeEach(async ({ page }) => {
  await mockWeather(page);
});

test("condition details expose hourly wind and cloud timing without additional requests", async ({
  page,
  isMobile,
}, testInfo) => {
  const now = Date.parse("2026-10-21T06:30:00Z");
  await page.clock.setFixedTime(new Date(now));
  await page.route("**/api/weather**", (route) =>
    route.fulfill({ json: forecast("48h", point, now) }),
  );
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const requests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/weather")
      requests.push(request.url());
  });
  await page.goto(shared);
  const wind = page.getByRole("button", {
    name: "Hourly wind conditions",
    exact: true,
  });
  await expect(wind).toHaveAttribute("aria-expanded", "false");
  const before = requests.length;
  await wind.focus();
  await page.keyboard.press("Enter");
  await expect(wind).toHaveAttribute("aria-expanded", "true");
  const detail = page.locator(".condition-detail");
  const slider = detail.getByRole("slider", {
    name: "Condition forecast hour",
  });
  await expect(
    detail.getByRole("heading", { name: "Wind conditions · Hourly forecast" }),
  ).toBeVisible();
  await detail.getByRole("button", { name: /Strongest wind/ }).click();
  await expect(
    detail.getByRole("button", { name: /Strongest wind/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await slider.focus();
  await slider.press("Home");
  await slider.press("ArrowRight");
  await expect(slider).toHaveValue("1");
  const main = page.getByRole("slider", { name: "Forecast hour", exact: true });
  await expect(main).toHaveAttribute("aria-valuenow", "1");
  await slider.press("End");
  await expect(main).toHaveAttribute(
    "aria-valuenow",
    await slider.inputValue(),
  );
  await expect(
    detail
      .getByRole("region", { name: "Wind speed at 10 m", exact: true })
      .locator(".condition-plot-heading > strong"),
  ).not.toHaveText("Unavailable");
  await detail.getByText("View wind hourly values", { exact: true }).click();
  await expect(detail.getByRole("table")).toBeVisible();
  await expect(
    detail.getByRole("columnheader", { name: "Gusts at 10 m (m/s)" }),
  ).toBeVisible();
  await detail.getByText("View wind hourly values", { exact: true }).click();
  for (const theme of ["light", "dark"]) {
    if (theme === "dark")
      await page
        .getByRole("button", { name: "Switch to dark appearance" })
        .click();
    await detail.scrollIntoViewIfNeeded();
    await expect(detail.locator(".recharts-surface")).toHaveCount(2);
    expect(
      await page
        .locator(".skip-link")
        .evaluate((link) => link.getBoundingClientRect().bottom),
    ).toBeLessThan(0);
    await page.locator(".daily-conditions").screenshot({
      path: `.impeccable/review/condition-wind-${testInfo.project.name}-${theme}.png`,
      // Keep the offscreen skip link out of Chrome's tall element capture.
      style: ".skip-link:not(:focus) { visibility: hidden; }",
    });
    expect(
      (await new AxeBuilder({ page }).include(".daily-conditions").analyze())
        .violations,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  }
  await detail.getByRole("button", { name: "Close hourly forecast" }).click();
  await expect(wind).toBeFocused();
  await expect(detail).toBeHidden();
  await page
    .getByRole("button", { name: "Hourly cloud cover", exact: true })
    .click();
  await expect(
    detail.getByRole("heading", {
      name: "Cloud cover and irradiance · Hourly forecast",
    }),
  ).toBeVisible();
  await expect(detail.locator(".condition-plot")).toHaveCount(2);
  await expect(detail).toContainText("Mean during each hour");
  if (isMobile) {
    await page.setViewportSize({ width: 320, height: 800 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  }
  await detail.screenshot({
    path: `.impeccable/review/condition-cloud-${testInfo.project.name}.png`,
  });
  await page
    .getByRole("button", { name: "Hourly humidity", exact: true })
    .click();
  await expect(detail.locator(".condition-plot")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Hourly precipitation", exact: true })
    .click();
  await expect(detail).toContainText(
    "Chance of more than 0.1 mm during each hour",
  );
  await page
    .getByRole("group", { name: "Day for weather tiles" })
    .getByRole("button")
    .nth(1)
    .click();
  await expect(slider).toHaveValue("0");
  expect(requests).toHaveLength(before);
  expect(errors).toEqual([]);
});

test("condition details preserve unavailable data and zero, including a partial final day", async ({
  page,
}) => {
  const now = Date.parse("2026-10-20T22:30:00Z");
  await page.clock.setFixedTime(new Date(now));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/weather**", async (route) => {
    const result = forecast("48h", point, now);
    for (const hour of result.hourly)
      Object.assign(hour, {
        windSpeedMs: null,
        windGustMs: null,
        humidityPct: null,
        cloudCoverPct: null,
        precipitationMm: 0,
        precipitationProbabilityPct: 0,
      });
    await route.fulfill({ json: result });
  });
  await page.goto(shared);
  await page
    .getByRole("button", { name: "Hourly wind conditions", exact: true })
    .click();
  const detail = page.locator(".condition-detail");
  await expect(detail).toContainText("No wind speed at 10 m data");
  await expect(
    detail.getByRole("button", { name: /Strongest wind/ }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Hourly precipitation", exact: true })
    .click();
  await expect(detail.locator(".condition-plot-heading > strong")).toHaveText([
    "0.0 mm",
    "0 %",
  ]);
  const days = page.getByRole("group", { name: "Day for weather tiles" });
  await days.getByRole("button").last().click();
  await expect(detail.getByRole("slider")).toBeDisabled();
  await expect(detail).toContainText(
    "No precipitation data for these forecast hours.",
  );
  await expect(detail.locator(".condition-plot-heading > strong")).toHaveText([
    "Unavailable",
    "Unavailable",
  ]);
});

test("condition inspection distinguishes repeated DST hours and the midnight gust", async ({
  page,
}) => {
  const now = Date.parse("2026-10-24T20:30:00Z");
  await page.clock.setFixedTime(new Date(now));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/weather**", async (route) => {
    const result = forecast("48h", point, now);
    result.location.timezone = "Europe/Helsinki";
    const midnight = result.hourly.find(
      (hour) => hour.time === Date.parse("2026-10-25T22:00:00Z"),
    )!;
    midnight.windGustMs = 30;
    await route.fulfill({ json: result });
  });
  await page.goto(shared);
  await page
    .getByRole("group", { name: "Day for weather tiles" })
    .getByRole("button")
    .first()
    .click();
  await page
    .getByRole("button", { name: "Hourly wind conditions", exact: true })
    .click();
  const detail = page.locator(".condition-detail");
  await detail.getByText("View wind hourly values", { exact: true }).click();
  await expect(
    detail.getByRole("rowheader", {
      name: "Sun 25 Oct, 03:00 GMT+3",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    detail.getByRole("rowheader", {
      name: "Sun 25 Oct, 03:00 GMT+2",
      exact: true,
    }),
  ).toBeVisible();
  await detail.getByRole("button", { name: /Peak gust/ }).click();
  await expect(detail.getByRole("slider")).toHaveValue("25");
  await expect(
    page.getByRole("slider", { name: "Forecast hour", exact: true }),
  ).toHaveAttribute("aria-valuenow", "25");
  await expect(detail).toContainText("23:00 GMT+2 - 00:00 GMT+2");
});

test("privacy notice is keyboard accessible and Sign out navigates to Cloudflare", async ({
  page,
  isMobile,
}, testInfo) => {
  if (isMobile) await page.setViewportSize({ width: 320, height: 800 });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto(shared);
  const originalUrl = page.url();
  const signOut = page
    .getByRole("banner")
    .getByRole("link", { name: "Sign out" });
  await expect(signOut).toBeVisible();
  await expect(signOut).toHaveAttribute("href", "/cdn-cgi/access/logout");
  const notice = page.getByRole("contentinfo").locator(".privacy-notice");
  const summary = notice.locator("summary");
  await expect(notice.locator(".privacy-copy")).toBeHidden();
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(notice.locator(".privacy-copy")).toBeVisible();
  await expect(notice).toContainText("Contact the person who invited you");
  await expect(notice).toContainText(
    "it does not remove saved locations or preferences",
  );
  await expect(page).toHaveURL(originalUrl);

  for (const theme of ["light", "dark"]) {
    if (theme === "dark")
      await page
        .getByRole("button", { name: "Switch to dark appearance" })
        .click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await signOut.scrollIntoViewIfNeeded();
    const target = await signOut.boundingBox();
    expect(target!.height).toBeGreaterThanOrEqual(44);
    expect(target!.x).toBeGreaterThanOrEqual(0);
    expect(target!.x + target!.width).toBeLessThanOrEqual(
      page.viewportSize()!.width,
    );
    await page
      .getByRole("banner")
      .screenshot({ path: testInfo.outputPath(`header-${theme}.png`) });
    await notice.scrollIntoViewIfNeeded();
    const violations = await new AxeBuilder({ page })
      .include(".app-header")
      .include(".app-footer")
      .analyze();
    expect(violations.violations).toEqual([]);
    await page
      .getByRole("contentinfo")
      .screenshot({ path: testInfo.outputPath(`privacy-${theme}.png`) });
  }

  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(notice.locator(".privacy-copy")).toBeHidden();
  await page.route("**/cdn-cgi/access/logout", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<main>Logout endpoint</main>",
    }),
  );
  const navigation = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/cdn-cgi/access/logout" &&
      request.isNavigationRequest(),
  );
  await signOut.click();
  expect((await navigation).resourceType()).toBe("document");
  await expect(page).toHaveURL(/\/cdn-cgi\/access\/logout$/);
});

test("welcome actions keep contrast on hover and Choose on map opens the location picker", async ({
  page,
  isMobile,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const search = page.getByRole("button", {
    name: "Search anywhere",
    exact: true,
  });
  for (const theme of ["light", "dark"]) {
    if (theme === "dark")
      await page
        .getByRole("button", { name: "Switch to dark appearance" })
        .click();
    await expect(page.locator("body")).toHaveCSS(
      "background-color",
      theme === "dark" ? "rgb(18, 18, 18)" : "rgb(247, 246, 243)",
    );
    await expect(page.locator(".brand > svg")).toHaveCSS(
      "fill",
      theme === "dark" ? "rgb(229, 231, 233)" : "rgb(25, 32, 37)",
    );
    await expect(
      page.locator(
        'meta[name="theme-color"][media="(prefers-color-scheme: light)"]',
      ),
    ).toHaveAttribute("content", theme === "dark" ? "#121212" : "#f7f6f3");
    await search.hover();
    const contrast = await search.evaluate((element) => {
      const style = getComputedStyle(element);
      const luminance = (color: string) =>
        color
          .match(/[\d.]+/g)!
          .slice(0, 3)
          .map(Number)
          .map((n) => n / 255)
          .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4))
          .reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0);
      const foreground = luminance(style.color),
        background = luminance(style.backgroundColor);
      return (
        (Math.max(foreground, background) + 0.05) /
        (Math.min(foreground, background) + 0.05)
      );
    });
    expect(contrast).toBeGreaterThanOrEqual(4.5);
  }
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(18, 18, 18)",
  );
  await expect(
    page.locator(
      'meta[name="theme-color"][media="(prefers-color-scheme: light)"]',
    ),
  ).toHaveAttribute("content", "#121212");
  const header = page.getByRole("banner");
  await expect(header.getByRole("navigation")).toHaveCount(0);
  await expect(header.locator(".brand > svg")).toHaveCSS(
    "height",
    isMobile ? "30px" : "36px",
  );
  const originalUrl = page.url();
  await expect(page.locator(".geo-map")).toHaveCount(0);
  const chooseOnMap = page.getByRole("button", {
    name: "Choose on map",
    exact: true,
  });
  await chooseOnMap.click();
  const picker = page.getByRole("dialog", {
    name: "Choose on map",
    exact: true,
  });
  await expect(picker).toBeVisible();
  await expect(page).toHaveURL(originalUrl);
  await expect(page.locator(".geo-map.expanded")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(chooseOnMap).toBeFocused();
  await chooseOnMap.click();
  await expect(picker).toBeVisible();
  await picker.getByRole("button", { name: "Search anywhere" }).click();
  await expect(
    page.getByRole("dialog", { name: "Change location" }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Choose on map" })
    .click();
  await expect(picker).toBeVisible();
  await expect(page).toHaveURL(originalUrl);
  await picker.getByRole("button", { name: "Use map center" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Daily summary" }),
  ).toBeVisible();
  await expect(page.locator("#main")).toBeFocused();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "The outlook for" }),
  ).toBeVisible();
  await expect(page).toHaveURL(originalUrl);
});

test("welcome motion keeps the heading steady and city shortcuts slow on hover", async ({
  page,
  isMobile,
}, testInfo) => {
  await page.emulateMedia({
    colorScheme: "light",
    reducedMotion: "no-preference",
  });
  await page.goto("/");
  const heading = page.getByRole("heading", {
    name: /^The outlook for/,
  });
  const search = page.getByRole("button", {
    name: "Search anywhere",
    exact: true,
  });
  await expect(heading).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(
    await heading.evaluate((element) =>
      parseFloat(getComputedStyle(element).fontSize),
    ),
  ).toBeGreaterThanOrEqual(isMobile ? 32 : 72);
  await expect(
    page
      .getByRole("banner")
      .getByRole("link", { name: "Säävirta", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".brand-wordmark")).toHaveText("Säävirta");
  await expect(page).toHaveTitle("Säävirta | Weather for energy");
  if (!isMobile) {
    const line = await heading.evaluate((element) => {
      const prefix = element
        .querySelector(".welcome-prefix")!
        .getBoundingClientRect();
      const metric = element
        .querySelector(".welcome-metric")!
        .getBoundingClientRect();
      const loop = element.querySelector(".text-loop")!;
      return {
        singleLine: metric.left >= prefix.right && metric.top < prefix.bottom,
        fits: loop.scrollWidth <= loop.clientWidth + 1,
      };
    });
    expect(line).toEqual({ singleLine: true, fits: true });
  }
  const searchTop = await search.evaluate(
    (element) => element.getBoundingClientRect().top + scrollY,
  );
  await expect(page.locator(".welcome-intro")).toHaveCSS(
    "font-size",
    isMobile ? "18px" : "20px",
  );
  await expect(page.getByText("Examples", { exact: true })).toHaveCount(0);
  const solar = page
    .locator(".text-loop-item")
    .filter({ has: page.locator(".sr-only", { hasText: "solar irradiance" }) });
  const icon = solar.locator(".text-roll-icon .text-roll-in");
  // Inspect the beginning of the actual roll: the icon must not flash fully drawn.
  const iconStartHeight = await page.locator(".text-loop-item").evaluate(
    (element) =>
      new Promise<number>((resolve) => {
        const observer = new MutationObserver(() => {
          const incoming = element.querySelector(
            ".text-roll-icon .text-roll-in",
          )!;
          observer.disconnect();
          resolve(incoming.getBoundingClientRect().height);
        });
        observer.observe(element, { childList: true, subtree: true });
      }),
  );
  expect(iconStartHeight).toBeLessThan(1);
  await expect(solar).toBeVisible();
  await expect
    .poll(() =>
      solar
        .locator(".text-roll-in")
        .last()
        .evaluate(
          (element) =>
            new DOMMatrixReadOnly(getComputedStyle(element).transform)
              .isIdentity,
        ),
    )
    .toBe(true);
  await expect(heading.locator(".welcome-prefix")).toHaveText(
    "The outlook for",
  );
  await expect(icon.locator("svg")).toBeVisible();
  expect(
    await search.evaluate(
      (element) => element.getBoundingClientRect().top + scrollY,
    ),
  ).toBe(searchTop);

  const cities = page.getByRole("navigation", {
    name: "Explore a city forecast",
  });
  await expect(cities.getByRole("link")).toHaveCount(8);
  await cities.scrollIntoViewIfNeeded();
  const sliders = cities.locator(".infinite-slider");
  await expect(sliders).toHaveCount(1);
  const slider = sliders.first();
  const track = slider.locator(".infinite-slider-track");
  const speed = () =>
    track.evaluate((element) => element.getAnimations()[0]?.playbackRate);
  const position = () =>
    track.evaluate((element) => {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
      return { x: matrix.m41, y: matrix.m42 };
    });
  await expect.poll(speed).toBe(1);
  const start = await position();
  expect(start.y).toBe(0);
  await expect.poll(async () => (await position()).x < start.x - 1).toBe(true);
  if (!isMobile) {
    await slider.hover();
    await expect.poll(speed).toBeCloseTo(1 / 3);
    await page.mouse.move(2, 2);
    await expect.poll(speed).toBe(1);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `.impeccable/review/welcome-${testInfo.project.name}.png`,
    fullPage: !isMobile,
  });
  await page.getByRole("button", { name: "Switch to dark appearance" }).click();
  // Let the appearance transition finish before the capture.
  await page.waitForTimeout(400);
  await page.screenshot({
    path: `.impeccable/review/welcome-${testInfo.project.name}-dark.png`,
    fullPage: !isMobile,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  if (isMobile) {
    await page.setViewportSize({ width: 320, height: 760 });
    expect(
      await page
        .locator(".text-loop")
        .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }

  // Use real pointer coordinates: the strip intentionally keeps moving on hover.
  await cities.scrollIntoViewIfNeeded();
  // At narrow widths the strip can briefly have no fully visible link.
  const shortcutHandle = await page.waitForFunction(() => {
    const links = [...document.querySelectorAll(".welcome-cities a")];
    const link = links.find((link) => {
      const box = link.getBoundingClientRect();
      const clip = link.closest(".infinite-slider")!.getBoundingClientRect();
      return (
        box.left > 16 &&
        box.right < innerWidth - 16 &&
        box.top >= Math.max(clip.top + 8, 16) &&
        box.bottom <= Math.min(clip.bottom - 8, innerHeight - 16)
      );
    });
    if (!link) return null;
    const box = link.getBoundingClientRect();
    return {
      name: link.querySelector(".city-name")!.textContent!.trim(),
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    };
  });
  const shortcut = (await shortcutHandle.jsonValue())!;
  await shortcutHandle.dispose();
  if (isMobile) await page.touchscreen.tap(shortcut.x, shortcut.y);
  else await page.mouse.click(shortcut.x, shortcut.y);
  await expect(
    page.getByRole("heading", { name: shortcut.name, exact: true }),
  ).toBeVisible();
});

test("welcome city links stay reachable by keyboard and reduced motion shows all metrics", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Use my location", exact: true })
    .focus();
  await page.keyboard.press("Tab");
  const cities = page.getByRole("navigation", {
    name: "Explore a city forecast",
  });
  await expect(cities.getByRole("link", { name: /Rotterdam/ })).toBeFocused();
  await expect(cities.locator(".infinite-slider").first()).toHaveAttribute(
    "data-static",
    "true",
  );
  for (let i = 0; i < 7; i++) await page.keyboard.press("Tab");
  const sydney = cities.getByRole("link", { name: /Sydney/ });
  await expect(sydney).toBeFocused();
  await expect(sydney).toBeInViewport();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".text-loop-item")).toHaveCount(0);
  await expect(page.locator(".welcome-sky .sky")).toHaveAttribute(
    "data-animating",
    "false",
  );
  await expect(page.locator(".text-loop-static")).toHaveText(
    "temperature, solar irradiance, humidity, wind conditions, cloud cover, precipitation",
  );
  expect(
    await cities.evaluate(
      (element) =>
        element
          .getAnimations({ subtree: true })
          .filter((animation) => animation.playState === "running").length,
    ),
  ).toBe(0);
  await expect(cities.getByRole("link")).toHaveCount(8);
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Sydney", exact: true }),
  ).toBeVisible();
});

test("welcome backgrounds follow each metric and keep text readable in both appearances", async ({
  page,
  isMobile,
}, testInfo) => {
  // CI uses software WebGL; retain the per-assertion deadlines below.
  test.setTimeout(process.env.CI ? 180_000 : 90_000);
  await page.emulateMedia({
    colorScheme: "light",
    reducedMotion: "no-preference",
  });
  await page.clock.install({ time: new Date("2026-10-15T09:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-15T09:00:01Z"));
  await page.goto("/");
  await page.clock.runFor(1000);
  const backdrop = page.locator(".welcome-sky");
  const canvas = backdrop.locator("canvas");
  for (const appearance of ["light", "dark"]) {
    if (appearance === "dark")
      await page
        .getByRole("button", { name: "Switch to dark appearance" })
        .click();
    await page.clock.runFor(400);
    await expect(canvas).toHaveAttribute("data-ready", "true");
    await expect(canvas).toHaveAttribute("data-animating", "true");
    const original = await canvas.elementHandle();
    for (const [metric, phase] of [
      ["temperature", "sun"],
      ["temperature", "snow"],
      ["solar irradiance", ""],
      ["humidity", ""],
      ["wind conditions", ""],
      ["cloud cover", ""],
      ["precipitation", ""],
    ]) {
      // Hold each scene while inspecting it; screenshots must not race the carousel.
      for (let step = 0; step < 64; step++) {
        if (
          (await backdrop.getAttribute("data-metric")) === metric &&
          (!phase ||
            (await backdrop.getAttribute("data-temperature")) === phase)
        )
          break;
        await page.clock.fastForward(400);
      }
      await expect(backdrop).toHaveAttribute("data-metric", metric);
      if (phase)
        await expect(backdrop).toHaveAttribute("data-temperature", phase);
      await expect(page.locator(".text-loop-item .sr-only")).toHaveText(metric);
      // The scene blend and letter roll complete together, without remounting the sky.
      await page.clock.fastForward(1100);
      expect(await original!.evaluate((element) => element.isConnected)).toBe(
        true,
      );
      const pixels = await canvas.evaluate((element: HTMLCanvasElement) => {
        const gl = element.getContext("webgl")!;
        // Read immediately after a real draw, before the buffer can be discarded.
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        const data = new Uint8Array(element.width * element.height * 4);
        gl.readPixels(
          0,
          0,
          element.width,
          element.height,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          data,
        );
        const channel = (n: number) =>
          n / 255 <= 0.04045
            ? n / 255 / 12.92
            : ((n / 255 + 0.055) / 1.055) ** 2.4;
        const luminance = (rgb: number[]) =>
          rgb.reduce(
            (sum, n, i) => sum + channel(n) * [0.2126, 0.7152, 0.0722][i],
            0,
          );
        let min = 1,
          max = 0;
        for (let i = 0; i < data.length; i += 64) {
          const value = luminance([data[i], data[i + 1], data[i + 2]]);
          min = Math.min(min, value);
          max = Math.max(max, value);
        }
        const text = getComputedStyle(
          document.querySelector(".welcome-privacy")!,
        )
          .color.match(/[\d.]+/g)!
          .slice(0, 3)
          .map(Number);
        const ink = luminance(text);
        return {
          min,
          max,
          contrast: Math.min(
            ...[min, max].map(
              (bg) => (Math.max(bg, ink) + 0.05) / (Math.min(bg, ink) + 0.05),
            ),
          ),
          pixels: element.width * element.height,
        };
      });
      expect(pixels.contrast).toBeGreaterThanOrEqual(4.5);
      expect(pixels.max - pixels.min).toBeGreaterThan(0.01);
      expect(pixels.pixels).toBeLessThanOrEqual(700_000);
      if (!isMobile)
        await page.screenshot({
          path: testInfo.outputPath(
            `${appearance}-${metric}${phase ? "-" + phase : ""}.png`,
          ),
        });
    }
  }
  await page.clock.resume();
  await page
    .getByRole("button", { name: "Search anywhere", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("daily summary boxes, comparisons, CSV, copy and chart scrubbing", async ({
  page,
  context,
  isMobile,
}, testInfo) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(shared);
  const temperature = page.getByRole("table", { name: "Temperature" }),
    solar = page.getByRole("table", { name: "Solar" });
  for (const [table, columns] of [
    [temperature, [/^Low to high/, /^vs normal/, /^Revision/, /^HDD/, /^CDD/]],
    [solar, [/^Energy/, /^vs normal/, /^Revision/, /^Peak/, /^Cloud/]],
  ] as const)
    for (const column of columns)
      await expect(
        table.getByRole("columnheader", { name: column }),
      ).toBeAttached();
  const tomorrow = temperature
    .getByRole("row")
    .filter({ has: page.getByRole("rowheader", { name: /^Tomorrow/ }) });
  // Illustrative normals are 10 °C and the previous run 0.5 °C warmer.
  await expect(tomorrow.locator("td").nth(1)).toHaveText(/^[+−]\d+\.\d$/);
  await expect(tomorrow.locator("td").nth(2)).toHaveText("−0.5");
  await expect(page.getByText(/^Normal: 2016-2025, mean/)).toBeVisible();
  await expect(page.locator(".current-temperature")).toContainText("16.2");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  expect((await download).suggestedFilename()).toBe(
    "saavirta-hourly-forecast.csv",
  );
  await page.getByRole("button", { name: "Copy table" }).click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
    /^Day\tDate\tLow °C/,
  );
  await page.getByRole("button", { name: "About the solar columns" }).click();
  await expect(page.getByText(/Not PV output/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText(/Not PV output/)).toBeHidden();
  const scrubber = page.getByRole("slider", { name: "Forecast hour" });
  await expect(scrubber).toHaveAttribute("aria-valuemax", "47");
  await expect(page.locator(".chart-block")).toHaveCount(2);
  const before = await page.locator(".inspection-time strong").innerText();
  await scrubber.scrollIntoViewIfNeeded();
  const box = (await scrubber.boundingBox())!;
  // Pressing (mouse or touch) selects an hour; pointer hover inspects on desktop.
  await scrubber.click({ position: { x: box.width * 0.6, y: 60 } });
  await expect(page.locator(".inspection-time strong")).not.toHaveText(before);
  if (!isMobile) {
    const clicked = await page.locator(".inspection-time strong").innerText();
    await page.mouse.move(box.x + box.width * 0.2, box.y + 60);
    await expect(page.locator(".inspection-time strong")).not.toHaveText(
      clicked,
    );
  }
  await scrubber.focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  await expect(scrubber).toHaveAttribute("aria-valuenow", "1");
  await page.keyboard.press("PageUp");
  await expect(scrubber).toHaveAttribute("aria-valuenow", "25");
  await page.keyboard.press("End");
  await expect(scrubber).toHaveAttribute("aria-valuenow", "47");
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
  await page.locator("#hourly").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `.impeccable/review/hourly-${testInfo.project.name}.png`,
  });
});

test("daily weather tiles follow the selected day and optional metrics can be filtered", async ({
  page,
  isMobile,
}, testInfo) => {
  await page.clock.setFixedTime(new Date("2026-10-14T22:30:00Z"));
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.route("**/api/weather**", async (route) => {
    const result = forecast(
      (new URL(route.request().url()).searchParams.get("horizon") ??
        "48h") as Horizon,
      point,
      Date.parse("2026-10-14T22:30:00Z"),
    );
    const clock = localClock(result.location.timezone);
    const firstDay = clock(result.hourly[0].time).day;
    for (const hour of result.hourly)
      Object.assign(hour, {
        humidityPct: clock(hour.time).day === firstDay ? 72 : 64,
        windSpeedMs: 5.2,
        windGustMs: 11.4,
        cloudCoverPct: hour.time === result.hourly[0].time ? 100 : 65,
        precipitationMm: 0,
        precipitationProbabilityPct: 60,
      });
    await route.fulfill({ json: result });
  });
  await page.goto(shared);
  const tiles = page.locator(".weather-tile");
  const humidity = page.getByRole("region", { name: "Humidity", exact: true });
  const filter = page.getByRole("button", {
    name: "Show metrics",
    exact: true,
  });
  const day = page.getByRole("group", { name: "Day for weather tiles" });
  await expect(
    page.getByRole("combobox", { name: "Day for weather tiles" }),
  ).toHaveCount(0);
  if (isMobile) {
    await expect(filter.locator(".metric-filter-label")).toBeHidden();
    await expect(filter).toHaveCSS("width", "44px");
  } else {
    await expect(filter.locator(".metric-filter-label")).toBeVisible();
  }
  await expect(tiles).toHaveCount(4);
  await expect(humidity.locator(".weather-tile-value")).toHaveText("72%");
  const cloud = page.getByRole("region", { name: "Cloud cover", exact: true });
  await expect(
    cloud.locator(".weather-meter + .weather-tile-description"),
  ).toHaveText("Mean sky coverage");
  await expect(
    cloud.locator(".weather-tile-detail .weather-meter"),
  ).toHaveCount(0);
  await expect(cloud.locator(".weather-tile-detail dd")).toHaveText("100 %");
  expect(
    await cloud
      .locator(".weather-meter > span")
      .evaluate((bar) => parseFloat((bar as HTMLElement).style.width)),
  ).toBeLessThan(100);
  await expect(
    page.getByRole("region", { name: "Wind conditions", exact: true }),
  ).toContainText("11.4 m/s");
  await expect(
    page.getByRole("region", { name: "Precipitation", exact: true }),
  ).toContainText("60 %");
  await expect(
    page
      .getByRole("region", { name: "Precipitation", exact: true })
      .locator(".weather-tile-value"),
  ).toHaveText("0.0mm");
  const nextDay = (await day
    .getByRole("button")
    .nth(1)
    .getAttribute("data-id"))!;
  await day.getByRole("button").nth(1).click();
  await expect(page).toHaveURL(new RegExp(`day=${nextDay}`));
  await expect(humidity.locator(".weather-tile-value")).toHaveText("64%");
  await page
    .getByRole("table", { name: "Temperature" })
    .getByRole("button")
    .first()
    .click();
  await expect(day.getByRole("button").first()).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(humidity.locator(".weather-tile-value")).toHaveText("72%");
  await filter.focus();
  await page.keyboard.press("Space");
  for (const name of ["Temperature", "Solar"]) {
    const checkbox = page.getByRole("checkbox", { name, exact: true });
    await expect(checkbox).toBeChecked();
    await expect(checkbox).toBeDisabled();
  }
  await page.keyboard.press("Tab");
  await expect(page.getByRole("checkbox", { name: "Humidity" })).toBeFocused();
  await page.keyboard.press("Space");
  await expect(humidity).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(filter).toBeFocused();
  await expect(page.locator(".metric-filter")).toBeHidden();
  await page.getByRole("button", { name: "7d", exact: true }).click();
  await expect(page).toHaveURL(/horizon=7d/);
  await expect.poll(() => day.getByRole("button").count()).toBeGreaterThan(6);
  await day.getByRole("button").last().focus();
  await page.keyboard.press("Space");
  await expect(day.getByRole("button").last()).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("slider")).toHaveAttribute("aria-valuemax", "0");
  await expect(page.locator(".inspection-value.temperature")).not.toContainText(
    "Unavailable",
  );
  await expect(humidity).toHaveCount(0);
  await filter.click();
  for (const name of ["Wind conditions", "Cloud cover", "Precipitation"]) {
    await page.getByRole("checkbox", { name, exact: true }).uncheck();
  }
  await expect(tiles).toHaveCount(0);
  await expect(page.getByRole("table", { name: "Temperature" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Solar" })).toBeVisible();
  for (const name of [
    "Humidity",
    "Wind conditions",
    "Cloud cover",
    "Precipitation",
  ]) {
    await page.getByRole("checkbox", { name, exact: true }).check();
  }
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "48h", exact: true }).click();
  await expect(tiles).toHaveCount(4);
  for (const theme of ["light", "dark"] as const) {
    if (theme === "dark")
      await page
        .getByRole("button", { name: "Switch to dark appearance" })
        .click();
    await page.locator(".daily-conditions").scrollIntoViewIfNeeded();
    await expect(
      page.locator('.weather-tile .sky[data-ready="true"]'),
    ).toHaveCount(4);
    await page.screenshot({
      path: testInfo.outputPath(`conditions-${theme}.png`),
    });
    await page.locator(".daily-boxes").screenshot({
      path: testInfo.outputPath(`primary-metrics-${theme}.png`),
    });
    await page.locator(".summary-heading").screenshot({
      path: testInfo.outputPath(`summary-controls-${theme}.png`),
    });
    await filter.click();
    await expect(
      page.getByRole("checkbox", { name: "Humidity" }),
    ).toBeVisible();
    const panel = await page.locator(".metric-filter").boundingBox();
    expect(panel!.x).toBeGreaterThanOrEqual(0);
    expect(panel!.y).toBeGreaterThanOrEqual(0);
    expect(panel!.y + panel!.height).toBeLessThanOrEqual(
      page.viewportSize()!.height,
    );
    expect(panel!.x + panel!.width).toBeLessThanOrEqual(
      page.viewportSize()!.width,
    );
    const a11y = await new AxeBuilder({ page })
      .include(".daily")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(a11y.violations).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`metrics-filter-${theme}.png`),
    });
    if (isMobile)
      await page.getByRole("button", { name: "Done", exact: true }).click();
    else await page.keyboard.press("Escape");
    await expect(page.locator(".metric-filter")).toBeHidden();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
  }
  if (isMobile) {
    await page.setViewportSize({ width: 320, height: 720 });
    // Recharts updates its SVG width through ResizeObserver after the viewport changes.
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      )
      .toBe(true);
  }
});

test("metric skies stay still until hovered and respect touch and reduced motion", async ({
  page,
  isMobile,
}, testInfo) => {
  test.setTimeout(process.env.CI ? 120_000 : 45_000);
  await page.emulateMedia({
    colorScheme: "light",
    reducedMotion: "no-preference",
  });
  await page.addInitScript(() => {
    const draw = WebGLRenderingContext.prototype.drawArrays;
    WebGLRenderingContext.prototype.drawArrays = function (...args) {
      draw.apply(this, args);
      const canvas = this.canvas as HTMLCanvasElement;
      canvas.dataset.draws = String(Number(canvas.dataset.draws ?? 0) + 1);
    };
  });
  await page.goto(shared);
  const panels = page.locator(".daily-box, .weather-tile");
  await expect(panels).toHaveCount(6);
  for (const theme of ["light", "dark"] as const) {
    if (theme === "dark")
      await page
        .getByRole("button", { name: "Switch to dark appearance" })
        .click();
    for (const panel of await panels.all()) {
      await panel.scrollIntoViewIfNeeded();
      await page.mouse.move(0, 0);
      const sky = panel.locator(".sky");
      await expect(sky).toHaveAttribute("data-ready", "true");
      await expect(sky).toHaveAttribute("data-animating", "false");
      await expect(sky).toHaveCSS(
        "opacity",
        await panel.evaluate((element) =>
          element.classList.contains("daily-box") ? "0.65" : "0.82",
        ),
      );
      const still = await sky.getAttribute("data-draws");
      await page.waitForTimeout(150);
      await expect(sky).toHaveAttribute("data-draws", still!);
      if (isMobile) {
        expect(
          await sky.evaluate(
            (element: HTMLCanvasElement) => element.width / element.clientWidth,
          ),
        ).toBeGreaterThan(1.5);
        await panel.tap({ position: { x: 20, y: 20 } });
        await expect(sky).toHaveAttribute("data-animating", "false");
      } else {
        await panel.hover({ position: { x: 20, y: 20 } });
        await expect(sky).toHaveAttribute("data-animating", "true");
        await expect
          .poll(async () => Number(await sky.getAttribute("data-draws")))
          .toBeGreaterThan(Number(still) + 2);
      }
      const rendered = await sky.evaluate(
        async (element: HTMLCanvasElement) => {
          const gl = element.getContext("webgl")!;
          const panel = element.parentElement!;
          const context = document.createElement("canvas").getContext("2d")!;
          const rgb = (color: string) => {
            context.fillStyle = color;
            context.fillRect(0, 0, 1, 1);
            return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
          };
          const luminance = (color: number[]) =>
            color.reduce((sum, n, i) => {
              const c = n / 255;
              return (
                sum +
                (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4) *
                  [0.2126, 0.7152, 0.0722][i]
              );
            }, 0);
          const ink = luminance(
            rgb(
              getComputedStyle(
                panel.querySelector(
                  ".weather-tile-description, .daily-table thead th:nth-child(2)",
                )!,
              ).color,
            ),
          );
          const surface = rgb(getComputedStyle(panel).backgroundColor);
          const opacity = Number(getComputedStyle(element).opacity);
          const pixels = () => {
            // Read a fresh draw: WebGL can discard its buffer after compositing.
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            const data = new Uint8Array(element.width * element.height * 4);
            gl.readPixels(
              0,
              0,
              element.width,
              element.height,
              gl.RGBA,
              gl.UNSIGNED_BYTE,
              data,
            );
            return data;
          };
          const before = pixels();
          await new Promise((resolve) => setTimeout(resolve, 700));
          const after = pixels();
          let contrast = Infinity,
            difference = 0,
            changed = 0,
            samples = 0;
          for (let i = 0; i < after.length; i += 16) {
            let delta = 0;
            for (const data of [before, after]) {
              const background = luminance(
                surface.map(
                  (value, channel) =>
                    value * (1 - opacity) + data[i + channel] * opacity,
                ),
              );
              contrast = Math.min(
                contrast,
                (Math.max(background, ink) + 0.05) /
                  (Math.min(background, ink) + 0.05),
              );
            }
            for (let channel = 0; channel < 3; channel++)
              delta +=
                (Math.abs(after[i + channel] - before[i + channel]) * opacity) /
                3;
            difference += delta;
            if (delta > 3) changed++;
            samples++;
          }
          return {
            contrast,
            difference: difference / samples,
            changed: changed / samples,
          };
        },
      );
      const name = await panel.getByRole("heading").textContent();
      expect(
        rendered.contrast,
        `${theme} ${name}: text contrast`,
      ).toBeGreaterThanOrEqual(4.5);
      if (!isMobile) {
        expect(
          rendered.difference,
          `${theme} ${name}: visible motion`,
        ).toBeGreaterThan(0.4);
        expect(
          rendered.changed,
          `${theme} ${name}: moving detail`,
        ).toBeGreaterThan(0.015);
      } else {
        expect(rendered.difference).toBe(0);
      }
      await page.mouse.move(0, 0);
      await expect(sky).toHaveAttribute("data-animating", "false");
    }
    await page
      .locator(".daily-boxes")
      .screenshot({ path: testInfo.outputPath(`primary-skies-${theme}.png`) });
    await page
      .locator(".daily-conditions")
      .screenshot({ path: testInfo.outputPath(`metric-skies-${theme}.png`) });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await panels.last().hover({ position: { x: 20, y: 20 } });
  await expect(page.locator('.daily .sky[data-animating="true"]')).toHaveCount(
    0,
  );
  await page.route("**/api/weather**", async (route) => {
    const result = forecast();
    for (const hour of result.hourly) hour.temperatureC = -6;
    await route.fulfill({ json: result });
  });
  await page.getByRole("button", { name: "Refresh forecast" }).click();
  await expect(panels.first().locator(".range").first()).toHaveText(
    "-6.0to -6.0",
  );
  for (const theme of ["dark", "light"] as const) {
    if (theme === "light")
      await page
        .getByRole("button", { name: "Switch to light appearance" })
        .click();
    await panels.first().screenshot({
      path: testInfo.outputPath(`temperature-snow-${theme}.png`),
    });
  }
});

test("weather tiles show unavailable data separately from zero values", async ({
  page,
}) => {
  let value: null | number = null;
  await page.route("**/api/weather**", async (route) => {
    const result = forecast();
    for (const hour of result.hourly)
      Object.assign(hour, {
        humidityPct: value,
        windSpeedMs: value,
        windGustMs: value,
        cloudCoverPct: value,
        precipitationMm: value,
        precipitationProbabilityPct: value,
      });
    await route.fulfill({ json: result });
  });
  await page.goto(shared);
  await expect(page.locator(".weather-tile-value")).toHaveText(
    Array(4).fill("Unavailable"),
  );
  await expect(page.locator(".weather-meter")).toHaveCount(0);
  value = 0;
  await page.getByRole("button", { name: "Refresh forecast" }).click();
  await expect(page.locator(".weather-tile-value")).toHaveText([
    "0%",
    "0.0m/s",
    "0%",
    "0.0mm",
  ]);
});

test("slow forecasts reserve their layout and maps load when brought into view", async ({
  page,
}) => {
  let resume!: () => void;
  const pending = new Promise<void>((resolve) => {
    resume = resolve;
  });
  await page.route("**/api/weather**", async (route) => {
    await pending;
    await route.fallback();
  });
  let cityRequests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/maps/cities.geojson")) cityRequests++;
  });
  try {
    await page.goto(shared);
    await expect(
      page.getByText("Retrieving the point forecast…"),
    ).toBeVisible();
    // The summary heading and its horizon control are usable before data arrives.
    await expect(
      page
        .locator(".summary-heading")
        .getByRole("group", { name: "Forecast horizon" }),
    ).toBeVisible();
    const position = await page.locator(".point-preferences").boundingBox();
    expect(position!.y).toBeGreaterThan(page.viewportSize()!.height);
    expect(cityRequests).toBe(0);
  } finally {
    resume();
  }
  await expect(page.getByRole("table", { name: "Temperature" })).toBeVisible();
  const map = page.locator(".map-surface");
  const position = await map.boundingBox();
  if (position!.y > page.viewportSize()!.height + 150)
    expect(cityRequests).toBe(0);
  await map.scrollIntoViewIfNeeded();
  await expect(map).toHaveAttribute("data-ready", "true");
  expect(cityRequests).toBe(1);
});

test("first visit, country flag, charts, inspection, horizons and hourly table", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "The outlook for" }),
  ).toBeVisible();
  expect(page.url()).not.toContain("lat=");
  await page.getByRole("link", { name: /Rotterdam/ }).press("Enter");
  await expect(
    page.getByRole("heading", { name: "Rotterdam", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".place-heading img")).toHaveAttribute(
    "src",
    "/flags/NL.svg",
  );
  await expect(page.getByText("Modelled at", { exact: false })).toBeVisible();
  const slider = page.getByRole("slider", { name: "Forecast hour" });
  await expect(slider).toHaveAttribute("aria-valuemax", "47");
  await slider.focus();
  await slider.press("ArrowRight");
  await expect(slider).toHaveAttribute("aria-valuenow", "1");
  await page.getByRole("button", { name: /Solar peak/ }).click();
  await expect(page.locator(".inspection-value.irradiance")).toContainText(
    "530",
  );
  await expect(
    page.locator(".signal").filter({ hasText: "Solar peak" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "7d", exact: true }).click();
  await expect(slider).toHaveAttribute("aria-valuemax", "167");
  await expect(page).toHaveURL(/horizon=7d/);
  // Seven local days, plus a partial first day unless the window starts at midnight.
  expect(
    await page
      .getByRole("table", { name: "Temperature" })
      .locator("tbody tr")
      .count(),
  ).toBeGreaterThanOrEqual(7);
  await page.getByRole("button", { name: "24h", exact: true }).click();
  await expect(slider).toHaveAttribute("aria-valuemax", "23");
  await page.getByText("View hourly data", { exact: true }).click();
  await expect(page.locator(".hourly-table tbody tr")).toHaveCount(24);
  expect(errors).toEqual([]);
});
test("search, browser history, persistence opt-in and corruption recovery", async ({
  page,
}) => {
  await page.goto(shared);
  await page
    .getByRole("button", { name: "Change location", exact: true })
    .click();
  await page.getByRole("searchbox", { name: "City or region" }).fill("Sydney");
  await page.getByRole("button", { name: /Sydney New South Wales/ }).click();
  await expect(
    page.getByRole("heading", { name: "Sydney", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Rotterdam", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "Sydney", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: "Remember this monitoring point" })
    .check();
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Sydney", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear saved point" }).click();
  expect(
    await page.evaluate(() => localStorage.getItem("saasignal:point")),
  ).toBeNull();
  await page.evaluate(() => localStorage.setItem("saasignal:point", "{broken"));
  await page.goto("/");
  await expect(
    page.getByText(/saved monitoring point could not be read/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Search anywhere", exact: true }),
  ).toBeVisible();
});
test("location dialog focuses entry, restores its opener and handles a removed opener", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  const search = page.getByRole("button", {
    name: "Search anywhere",
    exact: true,
  });
  const field = page.getByRole("searchbox", { name: "City or region" });
  const dialog = page.getByRole("dialog");
  await search.click();
  await expect(isMobile ? dialog : field).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(search).toBeFocused();
  await search.click();
  await page.getByRole("button", { name: "Close location dialog" }).click();
  await expect(search).toBeFocused();

  const device = page.getByRole("button", {
    name: "Use my location",
    exact: true,
  });
  await device.click();
  await expect(dialog).toBeFocused();
  await page.getByRole("button", { name: /Use approximate location/ }).click();
  await expect(isMobile ? dialog : field).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(device).toBeFocused();

  await search.click();
  await field.fill("Sydney");
  await page.getByRole("button", { name: /Sydney New South Wales/ }).click();
  await expect(page.getByRole("main")).toBeFocused();
  const change = page.getByRole("button", {
    name: "Change location",
    exact: true,
  });
  await change.click();
  await expect(isMobile ? dialog : field).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(change).toBeFocused();
});
test("geolocation is explicit, private, and has a denial fallback", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation(point);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Use my location", exact: true })
    .click();
  const privateRequest = page.waitForRequest(
    (request) =>
      request.url().endsWith("/api/weather") && request.method() === "POST",
  );
  await page.getByRole("button", { name: /Use precise location/ }).click();
  expect((await privateRequest).postDataJSON()).toMatchObject(point);
  await expect(
    page.getByRole("heading", { name: "Near Rotterdam", exact: true }),
  ).toBeVisible();
  expect(page.url()).not.toContain("lat=");
  expect(
    await page.evaluate(() => localStorage.getItem("saasignal:point")),
  ).toBeNull();
  await page.goto("/");
  await page.evaluate(() => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (
          _success: unknown,
          error: (value: { code: number }) => void,
        ) => error({ code: 1 }),
      },
    });
  });
  await page
    .getByRole("button", { name: "Use my location", exact: true })
    .click();
  await page.getByRole("button", { name: /Use precise location/ }).click();
  await expect(page.getByRole("alert")).toContainText(
    "permission was not granted",
  );
  await expect(
    page.getByRole("button", { name: "Search anywhere", exact: true }),
  ).toBeVisible();
});
test("device location still works without a nearby city or the city asset", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  for (const cityDataUnavailable of [false, true]) {
    await context.setGeolocation({ latitude: 0, longitude: 0 });
    if (cityDataUnavailable)
      await page.route("**/maps/cities.geojson", (route) =>
        route.fulfill({ status: 503 }),
      );
    await page.goto("/");
    await page
      .getByRole("button", { name: "Use my location", exact: true })
      .click();
    await page.getByRole("button", { name: /Use precise location/ }).click();
    await expect(
      page.getByRole("heading", { name: "0.000° N, 0.000° E", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Daily summary" }),
    ).toBeVisible();
    expect(page.url()).not.toContain("lat=");
  }
});

test("closing the location dialog discards a delayed city lookup", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation(point);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/maps/cities.geojson", async (route) => {
    await gate;
    await route.fulfill({ json: { type: "FeatureCollection", features: [] } });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Use my location", exact: true })
    .click();
  const lookup = page.waitForRequest("**/maps/cities.geojson");
  await page.getByRole("button", { name: /Use precise location/ }).click();
  await lookup;
  await page.getByRole("button", { name: "Close location dialog" }).click();
  const response = page.waitForResponse("**/maps/cities.geojson");
  release();
  await response;
  // A new, deliberate choice must not be replaced by the completed lookup.
  await page.getByRole("link", { name: /Rotterdam/ }).press("Enter");
  await expect(
    page.getByRole("heading", { name: "Rotterdam", exact: true }),
  ).toBeVisible();
});

test("expanded map pans without requesting weather and center selection commits", async ({
  page,
}) => {
  let calls = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/weather")) calls++;
  });
  await page.goto(shared);
  await expect(
    page.getByRole("heading", { name: "Daily summary" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Expand map", exact: true }).click();
  await expect(page.locator(".geo-map.expanded .map-surface")).toHaveAttribute(
    "data-ready",
    "true",
  );
  const mapCanvas = page
    .getByRole("dialog")
    .getByLabel(
      "Interactive map. Arrow keys pan. Use map center selects the point.",
    );
  await mapCanvas.focus();
  const before = calls;
  await mapCanvas.press("ArrowRight");
  await page.waitForTimeout(400);
  expect(calls).toBe(before);
  await page.getByRole("button", { name: "Use map center" }).click();
  await expect(
    page.getByRole("heading", { name: /^(Selected point|Near .+)$/ }),
  ).toBeVisible();
  await expect.poll(() => calls).toBeGreaterThan(before);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Daily summary" }),
  ).toBeVisible();
});
test("bundled city labels select Mysuru and appearance changes retain the map camera", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/?lat=12.3119&lon=76.6581&name=Selected%20point&view=map");
  await expect(page.getByText("Forecast Desk", { exact: true })).toHaveCount(0);
  await expect(page).toHaveTitle("Säävirta | Weather for energy");
  const map = page.locator(".geo-map.expanded");
  await expect(
    page.getByRole("dialog", { name: "Choose on map" }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.has("view")).toBe(false);
  await expect(map.locator(".map-surface")).toHaveAttribute(
    "data-ready",
    "true",
  );
  const canvas = map.locator("canvas");
  await page.screenshot({
    path: `.impeccable/review/map-picker-${testInfo.project.name}.png`,
    fullPage: true,
  });
  const size = await canvas.boundingBox();
  if (!size) throw new Error("Map canvas is missing");
  await canvas.focus();
  await canvas.press("ArrowRight");
  await page.waitForTimeout(400);
  const cameraPosition = await map.locator(".map-pin").getAttribute("style");
  const nextTheme =
    (await page.locator("html").getAttribute("data-theme")) === "dark"
      ? "light"
      : "dark";
  await page.emulateMedia({ colorScheme: nextTheme });
  await expect(page.locator("html")).toHaveAttribute("data-theme", nextTheme);
  await page.waitForTimeout(400);
  await expect(map.locator(".map-pin")).toHaveAttribute(
    "style",
    cameraPosition!,
  );
  await page.screenshot({
    path: `.impeccable/review/map-picker-${testInfo.project.name}-dark.png`,
    fullPage: true,
  });
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
  await map
    .locator(".map-places")
    .getByRole("button", { name: /Mysuru/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Mysuru", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".place-heading img")).toHaveAttribute(
    "src",
    "/flags/IN.svg",
  );
  await expect(page.locator(".place-meta")).toContainText("Karnataka");
  await expect(page).toHaveURL(/name=Mysuru/);
  // The inline map is also a direct selector; it doesn't open another workspace.
  const inlineMap = page.locator(".geo-map:not(.expanded)");
  await inlineMap.scrollIntoViewIfNeeded();
  await expect(inlineMap.locator(".map-surface")).toHaveAttribute(
    "data-ready",
    "true",
  );
  const inlineCanvas = inlineMap.locator("canvas");
  const inlineSize = await inlineCanvas.boundingBox();
  if (!inlineSize) throw new Error("Inline map canvas is missing");
  await inlineCanvas.click({
    position: { x: inlineSize.width / 2, y: inlineSize.height / 2 + 14 },
  });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Daily summary" }),
  ).toBeInViewport();
  expect(errors).toEqual([]);
});
test("failed retrieval is recoverable, stale and partial data are explicit, offline remains usable", async ({
  page,
  context,
}) => {
  let failing = true;
  await page.route("**/api/weather**", (route) => {
    if (failing)
      return route.fulfill({
        status: 503,
        json: {
          error: {
            code: "UNAVAILABLE",
            message: "Weather is temporarily unavailable.",
            retryable: true,
          },
        },
      });
    const value = forecast();
    value.source.retrievedAt -= 25 * 60_000;
    value.source.stale = true;
    value.source.refreshFailed = true;
    value.hourly[0].temperatureC = null;
    value.hourly[0].precipitationMm = null;
    for (const hour of value.hourly) {
      hour.cloudCoverPct = null;
      hour.humidityPct = null;
    }
    value.coverage.temperature--;
    return route.fulfill({ json: value });
  });
  await page.goto(shared);
  await expect(
    page.getByRole("heading", { name: "The forecast couldn’t be retrieved." }),
  ).toBeVisible();
  failing = false;
  await page.getByRole("button", { name: "Retry forecast" }).click();
  await expect(page.getByText(/The refresh failed/)).toBeVisible();
  await expect(page.getByText(/Incomplete coverage/)).toBeVisible();
  const temperatureRows = page
    .getByRole("table", { name: "Temperature" })
    .locator("tbody tr");
  // The first hour lacks temperature: that day's comparison and degree days are withheld.
  await expect(temperatureRows.first().locator("td").nth(1)).toContainText(
    "Unavailable",
  );
  await expect(temperatureRows.first().locator("td").nth(3)).toContainText(
    "Unavailable",
  );
  // Cloud cover is missing everywhere: every day says so, never "0" or "%".
  for (const row of await page
    .getByRole("table", { name: "Solar" })
    .locator("tbody tr")
    .all()) {
    await expect(row.locator("td").nth(4)).toContainText("Unavailable");
    await expect(row.locator("td").nth(4)).not.toContainText("%");
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.locator(".inspection-value.temperature")).toContainText(
    "Unavailable",
  );
  await context.setOffline(true);
  await expect(page.getByText(/You’re offline/)).toBeVisible();
  await expect(page.getByRole("slider")).toBeVisible();
  await context.setOffline(false);
});
test("rapid appearance changes keep forecast surfaces together without flashes", async ({
  page,
}) => {
  await page.emulateMedia({
    colorScheme: "light",
    reducedMotion: "no-preference",
  });
  await page.goto(shared);
  const tile = page.locator(".tile").first();
  await expect(tile).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Hourly forecast", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".hero .sky")).toHaveAttribute(
    "data-ready",
    "true",
  );
  const samples = page.evaluate(
    () =>
      new Promise<number[][]>((resolve) => {
        const context = document
          .createElement("canvas")
          .getContext("2d", { willReadFrequently: true })!;
        const channel = (element: Element) => {
          context.fillStyle = getComputedStyle(element).backgroundColor;
          context.fillRect(0, 0, 1, 1);
          return context.getImageData(0, 0, 1, 1).data[0];
        };
        const frames: number[][] = [];
        const start = performance.now();
        const sample = () => {
          frames.push([
            channel(document.body),
            channel(document.querySelector(".tile")!),
            channel(document.querySelector(".daily-table tbody th")!),
            channel(document.querySelector(".weather-tile")!),
            performance.now(),
          ]);
          if (performance.now() - start < 2500) requestAnimationFrame(sample);
          else resolve(frames);
        };
        sample();
      }),
  );
  const toggle = page.getByRole("button", {
    name: /^Switch to .* appearance$/,
  });
  await toggle.click();
  await page.waitForTimeout(300);
  for (let i = 0; i < 9; i++) {
    await toggle.click();
    await page.waitForTimeout(50);
  }
  const frames = await samples;
  // Both surfaces must interpolate together, including when a fade reverses.
  expect(
    frames.some(([background]) => background > 35 && background < 230),
  ).toBe(true);
  expect(
    Math.max(
      ...frames.map(([background, surface]) => Math.abs(surface - background)),
    ),
  ).toBeLessThan(18);
  expect(
    Math.max(...frames.map(([, surface, day]) => Math.abs(day - surface))),
  ).toBeLessThan(2);
  expect(
    Math.max(
      ...frames.map(([, surface, , weather]) => Math.abs(weather - surface)),
    ),
  ).toBeLessThan(2);
  expect(
    Math.max(
      ...frames
        .slice(1)
        // Software rendering can miss frames; compare change per 60 Hz frame.
        .map(
          ([background, , , , time], i) =>
            Math.abs(background - frames[i][0]) /
            Math.max(1, (time - frames[i][4]) / (1000 / 60)),
        ),
    ),
  ).toBeLessThan(180);
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(247, 246, 243)",
  );
  await expect(tile).toHaveCSS("background-color", "rgb(253, 252, 249)");
  await expect(page.locator(".hero .sky")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await expect(
    page.locator('meta[name="theme-color"]').first(),
  ).toHaveAttribute("content", "#f7f6f3");
  expect(
    await page.evaluate(() => localStorage.getItem("saasignal:theme")),
  ).toBe("light");
});

test("accessible layouts, light and dark themes, reduced motion and visual evidence", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await page.goto(shared);
  await expect(
    page.getByRole("heading", { name: "Daily summary", exact: true }),
  ).toBeVisible();
  await page.locator(".map-surface").scrollIntoViewIfNeeded();
  await expect(page.locator(".map-surface")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  await page.evaluate(() => window.scrollTo(0, 0));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await page.screenshot({
    path: `.impeccable/review/production-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Switch to dark appearance" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".map-surface")).toHaveAttribute(
    "data-ready",
    "true",
  );
  const dark = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(dark.violations).toEqual([]);
  await page.screenshot({
    path: `.impeccable/review/production-${testInfo.project.name}-dark.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Change location", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // Reduced motion: the sky is one still frame, so there is nothing to pause.
  await expect(page.locator(".hero .sky")).toHaveAttribute(
    "data-animating",
    "false",
  );
  await expect(
    page.getByRole("button", { name: /sky animation$/ }),
  ).toHaveCount(0);
  expect(
    await page
      .locator(".weather-symbol")
      .evaluate(
        (element) =>
          element
            .getAnimations({ subtree: true })
            .filter((a) => a.playState === "running").length,
      ),
  ).toBe(0);
});
test("refresh fetches a new retrieval, day focus zooms the charts and shortcuts work", async ({
  page,
}) => {
  let refreshes = 0;
  await page.route("**/api/weather**", async (route) => {
    const url = new URL(route.request().url());
    const result = forecast(
      (url.searchParams.get("horizon") ?? "48h") as Horizon,
    );
    if (url.searchParams.get("refresh") === "1") refreshes++;
    // Ordinary reads return the server's cached snapshot from 11 minutes ago.
    else result.source.retrievedAt -= 11 * 60_000;
    await route.fulfill({ json: result });
  });
  await page.goto(shared);
  const freshness = page.locator(".freshness");
  await expect(freshness).toContainText("Retrieved 11 min ago");
  await page.getByRole("button", { name: "Refresh forecast" }).click();
  await expect(freshness).toContainText("Retrieved just now");
  expect(refreshes).toBe(1);

  const scrubber = page.getByRole("slider", { name: "Forecast hour" });
  await page
    .getByRole("table", { name: "Temperature" })
    .getByRole("button", { name: /^Tomorrow/ })
    .click();
  await expect(page).toHaveURL(/day=\d{4}-\d{2}-\d{2}/);
  // One local day: 24 hours, or 23 and 25 on daylight-saving changes.
  await expect(scrubber).toHaveAttribute("aria-valuemax", /^2[234]$/);
  await expect(
    page
      .getByRole("group", { name: "Hours shown" })
      .getByRole("button", { name: "Tomorrow" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(scrubber).toHaveAttribute("aria-valuemax", "47");
  await expect(page).not.toHaveURL(/day=/);
  await page.keyboard.press("3");
  await expect(page).toHaveURL(/horizon=7d/);
  await expect(scrubber).toHaveAttribute("aria-valuemax", "167");
  await page.keyboard.press("/");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("the sky animates by default and panel hovers preserve light chart surfaces", async ({
  page,
  isMobile,
}, testInfo) => {
  await page.emulateMedia({
    reducedMotion: "no-preference",
    colorScheme: "light",
  });
  await page.addInitScript(() =>
    localStorage.setItem("saasignal:sky", "paused"),
  );
  await page.goto(shared);
  // The fixture is partly cloudy by day: a light sky with dark text.
  const hero = page.locator(".hero");
  await expect(hero).toHaveAttribute("data-tone", "light");
  const sky = page.locator(".hero .sky");
  await expect(sky).toHaveAttribute("data-ready", "true");
  await expect(sky).toHaveAttribute("data-animating", "true");
  await expect(
    page.getByRole("button", { name: /sky animation$/ }),
  ).toHaveCount(0);
  // A preference left by an older version cannot leave the sky frozen.
  await page.reload();
  await expect(sky).toHaveAttribute("data-animating", "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(sky).toHaveAttribute("data-animating", "false");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(sky).toHaveAttribute("data-animating", "true");
  // The horizon control sits with the summary it scopes.
  await expect(
    page
      .locator(".summary-heading")
      .getByRole("group", { name: "Forecast horizon" }),
  ).toBeVisible();
  if (!isMobile) {
    for (const title of [
      "Hourly forecast",
      "Hours to watch",
      "Monitoring point",
    ]) {
      const tile = page.locator(".tile").filter({
        has: page.getByRole("heading", { name: title, exact: true }),
      });
      const surface = await tile.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      );
      await tile.screenshot({ path: testInfo.outputPath(`${title}-rest.png`) });
      await tile.hover({ position: { x: 40, y: 20 } });
      await expect(tile).toHaveAttribute("data-hovered", "true");
      await expect(tile).toHaveCSS("background-color", surface);
      const highlight = tile.locator(".tile-highlight");
      await expect(highlight).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      await expect(highlight).toHaveCSS("border-top-width", "1px");
      await expect(highlight).toHaveCSS("opacity", "1");
      await tile.screenshot({
        path: testInfo.outputPath(`${title}-hover.png`),
      });
      await page.mouse.move(2, 2);
      await expect(tile.locator(".tile-highlight")).toHaveCount(0);
    }
    await page
      .getByRole("button", { name: "Switch to dark appearance" })
      .click();
    const hours = page
      .locator(".tile")
      .filter({ has: page.getByRole("heading", { name: "Hours to watch" }) });
    await hours.hover({ position: { x: 40, y: 20 } });
    await expect(hours.locator(".tile-highlight")).not.toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)",
    );
  } else {
    await page
      .getByRole("heading", { name: "Hourly forecast", exact: true })
      .tap();
    await expect(page.locator(".tile-highlight")).toHaveCount(0);
  }
});

test("without WebGL the band keeps a still sky gradient and no pause control", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    // Only the sky loses WebGL; the map keeps its own context.
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: Parameters<typeof original>
    ) {
      return this.classList.contains("sky") ? null : original.apply(this, args);
    } as typeof original;
  });
  await page.goto("/");
  await expect(page.locator(".welcome-sky")).toBeVisible();
  await expect(page.locator(".sky")).toHaveCount(0);
  await expect(page.locator(".welcome-sky")).toHaveCSS(
    "background-image",
    /linear-gradient/,
  );
  await page
    .getByRole("button", { name: "Search anywhere", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.goto(shared);
  const hero = page.locator(".hero");
  await expect(hero).toHaveAttribute("data-tone", "light");
  await expect(page.locator(".sky")).toHaveCount(0);
  await expect(page.locator(".daily .metric-backdrop")).toHaveCount(6);
  await expect(page.locator(".daily .metric-backdrop").last()).toHaveCSS(
    "background-image",
    /linear-gradient/,
  );
  await expect(
    page.getByRole("button", { name: /sky animation$/ }),
  ).toHaveCount(0);
  expect(
    await hero.evaluate((element) => getComputedStyle(element).backgroundImage),
  ).toContain("linear-gradient");
});
