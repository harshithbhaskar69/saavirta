import { afterEach, expect, test, vi } from "vitest";
const { reserve } = vi.hoisted(() => ({ reserve: vi.fn() }));
vi.mock("cloudflare:workers", () => ({
  env: { PROVIDER_BUDGET: { getByName: () => ({ reserve }) } },
}));
import { protectedFetch } from "../../src/lib/protected-fetch";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

test("invalid hosts and exhausted budgets never contact the provider", async () => {
  const transport = vi.fn();
  vi.stubGlobal("fetch", transport);
  await expect(protectedFetch("https://example.com")).rejects.toMatchObject({
    code: "CONFIGURATION",
  });
  expect(reserve).not.toHaveBeenCalled();
  reserve.mockResolvedValue(false);
  await expect(
    protectedFetch("https://api.open-meteo.com/v1/forecast"),
  ).rejects.toMatchObject({ code: "PROVIDER_BUDGET" });
  reserve.mockRejectedValue(new Error("storage unavailable"));
  await expect(
    protectedFetch("https://api.open-meteo.com/v1/forecast"),
  ).rejects.toMatchObject({ code: "PROVIDER_BUDGET" });
  expect(transport).not.toHaveBeenCalled();
});

test("redirects are rejected without forwarding credentials to another host", async () => {
  reserve.mockResolvedValue(true);
  const transport = vi.fn().mockResolvedValue(
    new Response(null, {
      status: 302,
      headers: { Location: "https://example.com" },
    }),
  );
  vi.stubGlobal("fetch", transport);
  const url = "https://api.open-meteo.com/v1/forecast";
  await expect(protectedFetch(url)).rejects.toMatchObject({ code: "UPSTREAM" });
  expect(transport).toHaveBeenCalledExactlyOnceWith(url, {
    redirect: "manual",
  });
});

test("ensemble requests charge all 51 members and reject models without a cost policy", async () => {
  reserve.mockResolvedValue(true);
  const transport = vi.fn().mockResolvedValue(Response.json({}));
  vi.stubGlobal("fetch", transport);
  const url =
    "https://ensemble-api.open-meteo.com/v1/ensemble?models=ecmwf_ifs025&hourly=temperature_2m,shortwave_radiation&forecast_hours=193";
  await protectedFetch(url);
  expect(reserve).toHaveBeenCalledWith("weather", 11);
  await expect(
    protectedFetch(url.replace("ecmwf_ifs025", "unbudgeted")),
  ).rejects.toMatchObject({ code: "CONFIGURATION" });
  expect(transport).toHaveBeenCalledTimes(1);
});
