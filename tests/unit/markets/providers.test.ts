import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import {
  decodeFingrid,
  fetchFingrid,
} from "../../../src/server/markets/fingrid";
import { decodeEntsoe, fetchEntsoe } from "../../../src/server/markets/entsoe";
import { ProviderClient } from "../../../src/server/markets/provider";
import {
  deliveryWindow,
  minute,
  pricePeriods,
} from "../../../src/server/markets/time";
import type {
  ProviderState,
  ProviderTransport,
} from "../../../src/server/markets/provider";
const directory = "tests/fixtures/markets/providers/";
const window = {
  start: "2026-10-15T00:00:00.000Z",
  end: "2026-10-15T01:00:00.000Z",
};
const xml = `<Publication_MarketDocument xmlns="urn:entsoe:test"><mRID>synthetic</mRID><revisionNumber>2</revisionNumber><type>A44</type><TimeSeries><currency_Unit.name>EUR</currency_Unit.name><price_Measure_Unit.name>MWH</price_Measure_Unit.name><in_Domain.mRID>10YFI-1--------U</in_Domain.mRID><out_Domain.mRID>10YFI-1--------U</out_Domain.mRID><contract_MarketAgreement.type>A01</contract_MarketAgreement.type><curveType>A03</curveType><Period><timeInterval><start>2026-10-15T00:00Z</start><end>2026-10-15T01:00Z</end></timeInterval><resolution>PT15M</resolution><Point><position>1</position><price.amount>-10</price.amount></Point><Point><position>3</position><price.amount>40</price.amount></Point></Period></TimeSeries></Publication_MarketDocument>`;
afterEach(() => vi.useRealTimers());
describe("Fingrid authenticated fixture contract", () => {
  it("decodes the captured envelopes for all eight datasets", () => {
    const files = readdirSync(directory).filter((f) =>
      f.startsWith("fingrid-"),
    );
    expect(files).toHaveLength(8);
    for (const name of files) {
      const data = decodeFingrid(
        readFileSync(directory + name, "utf8"),
        name.split("-")[1],
      );
      expect(data.intervals.length).toBeGreaterThan(0);
      expect(data.intervals[0].coverage).toBe(1);
    }
  });
  it("follows pagination and rejects truncated or wrong-dataset responses", async () => {
    const pages = [1, 2].map((n) =>
      readFileSync(`${directory}pagination-124-${n}.json`, "utf8"),
    );
    let clock = Date.parse(window.start);
    const get = vi.fn(async () => {
      clock += 5000;
      return pages.shift()!;
    });
    const batch = await fetchFingrid(
      { get },
      "synthetic-key",
      "124",
      window,
      new AbortController().signal,
      () => clock,
    );
    expect(get).toHaveBeenCalledTimes(2);
    expect(batch.intervals).toHaveLength(96);
    expect(batch.publishedAt).toBeNull();
    expect(batch.collectedAt).toBe("2026-10-15T00:00:10.000Z");
    const raw = readFileSync(`${directory}pagination-124-1.json`, "utf8");
    expect(() => decodeFingrid(raw, "74")).toThrow();
    await expect(
      fetchFingrid(
        { get: async () => raw },
        "synthetic-key",
        "124",
        window,
        new AbortController().signal,
      ),
    ).rejects.toThrow("pagination-mismatch");
  });
});
describe("ENTSO-E authenticated response structure with replacement prices", () => {
  it.each([
    ["quarter-hour", "2026-10-17", 192, 96, 15],
    ["hourly", "2025-08-01", 48, 24, 60],
  ] as const)(
    "aligns the %s response to a Helsinki delivery day",
    (name, date, nativeCount, deliveryCount, resolution) => {
      const decoded = decodeEntsoe(
        readFileSync(`${directory}entsoe-${name}.xml`, "utf8"),
      );
      expect(decoded.intervals).toHaveLength(nativeCount);
      const requested = deliveryWindow(date, 1);
      const selected = pricePeriods(decoded.intervals, requested);
      expect(selected).toHaveLength(deliveryCount);
      expect(selected[0].start).toBe(requested.start);
      expect(selected.at(-1)?.end).toBe(requested.end);
      expect(
        selected.every((point) => point.coverage === 1 && point.value !== null),
      ).toBe(true);
      expect(
        selected.every(
          (point) =>
            Date.parse(point.end) - Date.parse(point.start) ===
            resolution * minute,
        ),
      ).toBe(true);
    },
  );
  it("keeps an authenticated no-data acknowledgement empty", () => {
    const decoded = decodeEntsoe(
      readFileSync(`${directory}entsoe-unpublished.xml`, "utf8"),
    );
    expect(decoded.intervals).toEqual([]);
    expect(decoded.revision).toBeNull();
  });
});
describe("ENTSO-E synthetic contract edge cases", () => {
  it("expands A03 only within each publication period and preserves A01 gaps", () => {
    const block = decodeEntsoe(xml);
    expect(block.intervals.map((p) => p.value)).toEqual([-10, -10, 40, 40]);
    expect(block.revision).toBe("synthetic/2");
    const discrete = decodeEntsoe(
      xml.replace("<curveType>A03", "<curveType>A01"),
    );
    expect(discrete.intervals).toHaveLength(2);
    expect(discrete.intervals[0].end).not.toBe(discrete.intervals[1].start);
    const multiple = xml.replace(
      "</TimeSeries>",
      "<Period><timeInterval><start>2026-10-15T02:00Z</start><end>2026-10-15T03:00Z</end></timeInterval><resolution>PT60M</resolution><Point><position>1</position><price.amount>20</price.amount></Point></Period></TimeSeries>",
    );
    expect(decodeEntsoe(multiple).intervals[4].start).toBe(
      "2026-10-15T02:00:00.000Z",
    );
  });
  it("requires FI, EUR/MWh, supported curves and finite ordered values", () => {
    for (const [from, to] of [
      ["EUR", "USD"],
      ["MWH", "KWH"],
      ["<position>3", "<position>1"],
      ["PT15M", "PT5M"],
      ["<price.amount>-10", "<price.amount>NaN"],
      [
        "<contract_MarketAgreement.type>A01",
        "<contract_MarketAgreement.type>A07",
      ],
      ["10YFI-1--------U", "10YSE-1--------K"],
    ])
      expect(() => decodeEntsoe(xml.replace(from, to))).toThrow();
    expect(() =>
      decodeEntsoe(`<!DOCTYPE x [<!ENTITY x "bad">]>${xml}`),
    ).toThrow();
    expect(
      decodeEntsoe(
        `<Acknowledgement_MarketDocument><Reason><code>999</code><text>No matching data found</text></Reason></Acknowledgement_MarketDocument>`,
      ).intervals,
    ).toEqual([]);
    expect(() =>
      decodeEntsoe(
        `<Acknowledgement_MarketDocument><Reason><code>401</code><text>Unauthorized</text></Reason></Acknowledgement_MarketDocument>`,
      ),
    ).toThrow();
  });
  it("requests only the FI day-ahead contract and never invents an issue time", async () => {
    const get = vi.fn<ProviderTransport["get"]>(async () => xml);
    const batch = await fetchEntsoe(
      { get },
      "synthetic-token",
      window,
      new AbortController().signal,
    );
    const url = get.mock.calls[0]?.[0];
    expect(url?.searchParams.get("contract_MarketAgreement.type")).toBe("A01");
    expect(batch.publishedAt).toBeNull();
  });
});
describe("persistent provider budget and failure policy", () => {
  function setup(send: typeof fetch) {
    let state: ProviderState = { next: 0, cooldown: 0, requests: [] };
    const storage = {
      read: async () => structuredClone(state),
      write: async (next: ProviderState) => {
        state = structuredClone(next);
      },
    };
    return { client: new ProviderClient("fingrid", storage, send), storage };
  }
  it("spaces calls, persists cooldown across clients, and never follows redirects", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse(window.start));
    const send = vi.fn<typeof fetch>(async () => Response.json({})),
      { client, storage } = setup(send),
      url = new URL("https://data.fingrid.fi/api/datasets/124/data"),
      signal = new AbortController().signal;
    await client.get(url, {}, signal);
    const second = client.get(url, {}, signal);
    await vi.advanceTimersByTimeAsync(2499);
    expect(send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await second;
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0][1]?.redirect).toBe("manual");
    send.mockImplementation(
      async () =>
        new Response("private", {
          status: 429,
          headers: { "Retry-After": "120" },
        }),
    );
    const limited = expect(client.get(url, {}, signal)).rejects.toThrow(
      "provider-rate-limited",
    );
    await vi.advanceTimersByTimeAsync(2500);
    await limited;
    await expect(
      new ProviderClient("fingrid", storage, send).get(url, {}, signal),
    ).rejects.toThrow("provider-cooldown");
    expect(send).toHaveBeenCalledTimes(3);
  });
  it("stops at the daily quota and honors cancellation before any request", async () => {
    const send = vi.fn<typeof fetch>(),
      { client, storage } = setup(send),
      url = new URL("https://data.fingrid.fi/api");
    await storage.write({
      next: 0,
      cooldown: 0,
      requests: Array(9000).fill(Date.now()),
    });
    await expect(
      client.get(url, {}, new AbortController().signal),
    ).rejects.toThrow("provider-budget-exhausted");
    await expect(client.get(url, {}, AbortSignal.abort())).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
    await expect(
      client.get(
        new URL("https://example.com/"),
        {},
        new AbortController().signal,
      ),
    ).rejects.toThrow("provider-request-invalid");
  });
});
