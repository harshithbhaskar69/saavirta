import { describe, expect, it, vi } from "vitest";
import { marketRequest } from "../../../src/server/markets/http";
import { DemoReader } from "../../../src/server/markets/demo";
import { dashboardSchema } from "../../../src/features/markets/contracts";
const now = Date.parse("2026-10-15T12:00Z");
const options = {
  now,
  demonstration: true,
  production: false,
  pricesEnabled: true,
  priceExportAllowed: false,
  rateLimit: async () => ({ success: true }),
};
const input = {
  latitude: 60.1695,
  longitude: 24.9354,
  date: "2026-10-15",
  days: 1,
  resolution: "PT15M",
};
const request = (body: unknown): Request =>
  new Request("https://app.example/api/v1/markets/fi/dashboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
describe("market Worker API", () => {
  it("serves the contract from local data without invoking a provider", async () => {
    const res = await marketRequest(
      request(input),
      "dashboard",
      new DemoReader(now),
      options,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const data = dashboardSchema.parse(await res.json());
    expect(data.metrics[0].quality.coverage).toBe(1);
    expect(data.priceExportAllowed).toBe(false);
    expect(data.marketContext.demonstration).toBe(true);
  });
  it("rejects invalid, oversized, out-of-range and country-spoofed input", async () => {
    const store = new DemoReader(now),
      read = vi.spyOn(store, "read");
    for (const body of [
      { ...input, latitude: 91 },
      { ...input, countryCode: "FI" },
      { ...input, extra: "x".repeat(1024) },
      { ...input, date: "2026-02-30" },
      { ...input, date: "2026-10-18" },
      { ...input, date: "2026-10-17", days: 2 },
    ])
      expect(
        (await marketRequest(request(body), "dashboard", store, options))
          .status,
      ).toBe(400);
    expect(read).not.toHaveBeenCalled();
  });
  it("enforces geography, production mode and limits", async () => {
    const store = new DemoReader(now);
    expect(
      (
        await marketRequest(
          request({ ...input, latitude: 59.3293, longitude: 18.0686 }),
          "dashboard",
          store,
          options,
        )
      ).status,
    ).toBe(422);
    expect(
      (
        await marketRequest(request(input), "dashboard", store, {
          ...options,
          rateLimit: async () => ({ success: false }),
        })
      ).status,
    ).toBe(429);
    expect(
      (
        await marketRequest(request(input), "dashboard", store, {
          ...options,
          production: true,
        })
      ).status,
    ).toBe(503);
  });
  it("returns partial sections and sanitizes storage failures", async () => {
    const store = new DemoReader(now),
      read = store.read.bind(store);
    vi.spyOn(store, "read").mockImplementation(async (dataset, w) => {
      if (dataset === "245") throw new Error("private-details");
      return read(dataset, w);
    });
    const res = await marketRequest(
        request(input),
        "dashboard",
        store,
        options,
      ),
      data = dashboardSchema.parse(await res.json());
    expect(res.status).toBe(200);
    expect(data.metrics[0].quality.coverage).toBe(0);
    expect(
      data.series.find((s) => s.dataset === "245")?.quality.issues,
    ).toContain("storage-unavailable");
    expect(JSON.stringify(data)).not.toContain("private-details");
  });
  it("withholds stored prices until display permission is enabled", async () => {
    const store = new DemoReader(now);
    const read = vi.spyOn(store, "read");
    const response = await marketRequest(request(input), "dashboard", store, {
      ...options,
      pricesEnabled: false,
      priceExportAllowed: true,
    });
    const data = dashboardSchema.parse(await response.json());
    const prices = data.series.find((series) => series.dataset === "price");
    expect(prices?.quality.issues).toContain("price-permission-required");
    expect(prices?.intervals.every((period) => period.value === null)).toBe(
      true,
    );
    expect(read.mock.calls.some(([dataset]) => dataset === "price")).toBe(
      false,
    );
    expect(data.priceExportAllowed).toBe(false);
    expect(
      data.priceSummaries.every((summary) => summary.average === null),
    ).toBe(true);
  });
});
