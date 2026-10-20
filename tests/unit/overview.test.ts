import { describe, expect, it } from "vitest";
import {
  compareDays,
  dailySummary,
  forecastCsv,
  normalSeries,
  localDays,
  windHighlights,
} from "../../src/features/weather/overview";
import type { Baselines, Hour } from "../../src/features/weather/types";
import { HOUR } from "../fixtures/weather";

const series = (start: string, count: number, values: Partial<Hour> = {}) =>
  Array.from({ length: count }, (_, i): Hour => ({
    time: Date.parse(start) + i * HOUR,
    temperatureC: 10,
    solarIrradianceWm2: 500,
    windSpeedMs: 4,
    windGustMs: 8,
    cloudCoverPct: 25,
    humidityPct: 60,
    precipitationMm: 0.5,
    precipitationProbabilityPct: 40,
    ...values,
  }));

describe("wind forecast hours to inspect", () => {
  it("preserves calm wind, skips missing values and picks the first tied extreme", () => {
    const hours = series("2026-10-13T12:00:00Z", 4);
    hours[0].windSpeedMs = null;
    hours[1].windSpeedMs = 0;
    hours[2].windSpeedMs = 9;
    hours[3].windSpeedMs = 9;
    expect(windHighlights(hours, [])).toEqual([
      {
        label: "Strongest wind",
        value: 9,
        time: hours[2].time,
        precedingHour: false,
      },
      {
        label: "Lowest wind",
        value: 0,
        time: hours[1].time,
        precedingHour: false,
      },
    ]);
    expect(
      windHighlights(
        series("2026-10-13T12:00:00Z", 2, { windSpeedMs: null }),
        [],
      ),
    ).toEqual([]);
  });

  it("keeps the midnight gust with the preceding day, including the repeated DST hour", () => {
    const hours = series("2026-10-24T21:00:00Z", 26);
    hours[4].windSpeedMs = 12;
    hours[25].windGustMs = 20;
    const day = localDays(hours, "Europe/Helsinki")[0];
    expect(day.instants).toHaveLength(25);
    expect(windHighlights(day.instants, day.intervals)).toMatchObject([
      { label: "Strongest wind", time: hours[4].time, value: 12 },
      { label: "Lowest wind", time: hours[0].time },
      {
        label: "Peak gust",
        time: hours[25].time,
        value: 20,
        precedingHour: true,
      },
    ]);
    expect(windHighlights([], [])).toEqual([]);
  });
});

describe("daily summary by local day", () => {
  it("splits a rolling 48-hour window into partial and complete local days", () => {
    // 17:00 Tuesday in Amsterdam (UTC+2) for 48 hours.
    const days = dailySummary(
      series("2026-10-13T15:00:00Z", 48),
      "Europe/Amsterdam",
    );
    expect(days.map((d) => d.key)).toEqual([
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
    ]);
    expect(days.map((d) => [d.startsLate, d.endsEarly])).toEqual([
      [true, false],
      [false, false],
      [false, true],
    ]);
    const [today, tomorrow, last] = days;
    expect(tomorrow).toMatchObject({
      low: 10,
      high: 10,
      heatingDegreeDays: 8,
      coolingDegreeDays: 0,
      solarEnergyKwhM2: 12,
      precipitationMm: 12,
      cloudMeanPct: 25,
      humidityMeanPct: 60,
      humidityLowPct: 60,
      humidityHighPct: 60,
      windMeanMs: 4,
      windMaxMs: 4,
      windGustMaxMs: 8,
      precipitationProbabilityMaxPct: 40,
    });
    // Seven instants (17:00-23:00) but eight intervals, including 23:00-24:00.
    expect(today.heatingDegreeDays).toBeCloseTo(7 / 3);
    expect(today.solarEnergyKwhM2).toBe(4);
    expect(last.solarEnergyKwhM2).toBe(8);
  });

  it("assigns a preceding-hour interval to the day it starts in", () => {
    const hours = series("2026-10-13T15:00:00Z", 48, {
      solarIrradianceWm2: 0,
    });
    const midnight = Date.parse("2026-10-13T22:00:00Z"); // 00:00 Wednesday local
    hours.find((h) => h.time === midnight)!.solarIrradianceWm2 = 1000;
    const [tuesday, wednesday] = dailySummary(hours, "Europe/Amsterdam");
    expect(tuesday).toMatchObject({
      solarEnergyKwhM2: 1,
      solarPeakWm2: 1000,
      solarPeakTime: midnight,
    });
    expect(wednesday).toMatchObject({
      solarEnergyKwhM2: 0,
      solarPeakWm2: 0,
      solarPeakTime: null,
    });
  });

  it("keeps a 25-hour daylight-saving day complete", () => {
    // Local midnight on 25 October is 22:00 UTC the day before (CEST).
    const days = dailySummary(
      series("2026-10-24T22:00:00Z", 26),
      "Europe/Amsterdam",
    );
    expect(days[0]).toMatchObject({
      key: "2026-10-25",
      startsLate: false,
      endsEarly: false,
      solarEnergyKwhM2: 12.5,
      precipitationMm: 12.5,
    });
    expect(days[0].heatingDegreeDays).toBeCloseTo(25 / 3);
    expect(days[1]).toMatchObject({ key: "2026-10-26", endsEarly: true });
  });

  it("keeps weather samples on their local day and interval peaks on the preceding day", () => {
    const hours = series("2026-10-13T20:00:00Z", 3);
    // 22:00, 23:00 and midnight in Amsterdam. One missing sample is not zero.
    Object.assign(hours[0], {
      humidityPct: 20,
      windSpeedMs: 2,
      cloudCoverPct: 0,
    });
    Object.assign(hours[1], {
      humidityPct: null,
      windSpeedMs: null,
      cloudCoverPct: null,
    });
    Object.assign(hours[2], {
      humidityPct: 90,
      windSpeedMs: 20,
      cloudCoverPct: 100,
      windGustMs: 30,
      precipitationMm: 5,
      precipitationProbabilityPct: 80,
    });
    const [today, tomorrow] = dailySummary(hours, "Europe/Amsterdam");
    expect(today).toMatchObject({
      humidityMeanPct: 20,
      humidityLowPct: 20,
      humidityHighPct: 20,
      windMeanMs: 2,
      windMaxMs: 2,
      windGustMaxMs: 30,
      cloudMeanPct: 0,
      cloudMaxPct: 0,
      precipitationMm: 6,
      precipitationProbabilityMaxPct: 80,
    });
    expect(tomorrow).toMatchObject({
      humidityMeanPct: 90,
      windMeanMs: 20,
      cloudMeanPct: 100,
      windGustMaxMs: null,
      precipitationMm: null,
      precipitationProbabilityMaxPct: null,
    });
  });

  it("distinguishes unavailable weather metrics from dry, clear and calm conditions", () => {
    for (const value of [null, 0]) {
      const [day] = dailySummary(
        series("2026-10-13T12:00:00Z", 3, {
          humidityPct: value,
          windSpeedMs: value,
          windGustMs: value,
          cloudCoverPct: value,
          precipitationMm: value,
          precipitationProbabilityPct: value,
        }),
        "UTC",
      );
      expect(day).toMatchObject({
        humidityMeanPct: value,
        humidityLowPct: value,
        humidityHighPct: value,
        windMeanMs: value,
        windMaxMs: value,
        windGustMaxMs: value,
        cloudMeanPct: value,
        cloudMaxPct: value,
        precipitationMm: value,
        precipitationProbabilityMaxPct: value,
      });
    }
  });

  it("uses local midnight in half-hour offset time zones", () => {
    // Whole UTC hours fall at :30 in Kolkata; 19:00 UTC is 00:30 local.
    const days = dailySummary(
      series("2026-10-13T19:00:00Z", 25),
      "Asia/Kolkata",
    );
    expect(days[0]).toMatchObject({
      key: "2026-10-14",
      startsLate: false,
      endsEarly: false,
    });
  });

  it("withholds totals with missing samples but keeps available extremes", () => {
    const hours = series("2026-10-13T22:00:00Z", 25);
    hours[3] = {
      ...hours[3],
      temperatureC: null,
      solarIrradianceWm2: null,
      precipitationMm: null,
      cloudCoverPct: null,
    };
    hours[5].temperatureC = 4;
    const [day] = dailySummary(hours, "Europe/Amsterdam");
    expect(day).toMatchObject({
      low: 4,
      high: 10,
      heatingDegreeDays: null,
      coolingDegreeDays: null,
      solarEnergyKwhM2: null,
      precipitationMm: null,
      cloudMeanPct: 25,
    });
    const hot = dailySummary(
      series("2026-10-13T22:00:00Z", 25, { temperatureC: 28 }),
      "Europe/Amsterdam",
    );
    expect(hot[0].coolingDegreeDays).toBe(6);
    expect(dailySummary([], "UTC")).toEqual([]);
  });

  it("exports every metric, keeps missing cells empty and disambiguates repeated DST hours in UTC", () => {
    const input = series("2026-10-25T00:00:00Z", 2, { temperatureC: null });
    const rows = forecastCsv(input, "Europe/Amsterdam").split("\r\n");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain("solar_preceding_hour_mean_W_m2");
    expect(rows[0]).toContain("precipitation_probability_pct");
    expect(rows[1]).toContain('"2026-10-25T00:00:00.000Z","2026-10-25 02:00"');
    expect(rows[2]).toContain('"2026-10-25T01:00:00.000Z","2026-10-25 02:00"');
    expect(rows[1]).toContain('"Europe/Amsterdam",,"500"');
  });
});

describe("comparisons against normals and the previous run", () => {
  // 17:00 Tuesday local for 48 hours: Tuesday (partial), Wednesday, Thursday (partial).
  const hours = series("2026-10-13T15:00:00Z", 48);
  const normalDay = (temperatureC: number, solarIrradianceWm2: number) => ({
    temperatureC: Array<number | null>(24).fill(temperatureC),
    solarIrradianceWm2: Array<number | null>(24).fill(solarIrradianceWm2),
  });
  const baselines = (overrides: Partial<Baselines> = {}): Baselines => ({
    timezone: "Europe/Amsterdam",
    normals: {
      source: "ERA5 and ERA5-Land reanalysis",
      years: [2016, 2025],
      yearCount: 10,
      smoothingDays: 3,
      days: Object.fromEntries(
        ["2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"].map((d) => [
          d,
          normalDay(12, 400),
        ]),
      ),
    },
    revision: {
      model: "ECMWF IFS 9 km",
      latestRun: Date.parse("2026-10-13T06:00:00Z"),
      previousRun: Date.parse("2026-10-12T06:00:00Z"),
      // The older run ends before Thursday afternoon.
      hours: hours
        .filter((h) => h.time <= Date.parse("2026-10-15T06:00:00Z"))
        .map((h) => ({
          time: h.time,
          latestC: 11,
          previousC: 10,
          latestWm2: 300,
          previousWm2: 200,
        })),
    },
    ...overrides,
  });
  it("compares each day with the normal over the same hours, including partial days", () => {
    const days = compareDays(hours, "Europe/Amsterdam", baselines());
    // Forecast 10 °C against a 12 °C normal; 500 against 400 W/m² is 25% more sunshine.
    for (const key of ["2026-10-13", "2026-10-14", "2026-10-15"])
      expect(days.get(key)).toMatchObject({
        anomalyC: -2,
        solarAnomalyPct: 25,
      });
  });
  it("reports the run-to-run revision only where both runs cover every hour of the day", () => {
    const days = compareDays(hours, "Europe/Amsterdam", baselines());
    expect(days.get("2026-10-14")).toMatchObject({
      revisionC: 1,
      revisionKwhM2: 2.4,
    });
    expect(days.get("2026-10-15")).toMatchObject({
      revisionC: null,
      revisionKwhM2: null,
    });
  });
  it("withholds comparisons with a missing hour, little normal sunshine or another time zone", () => {
    const gap = baselines();
    gap.normals!.days["2026-10-14"].temperatureC[5] = null;
    expect(
      compareDays(hours, "Europe/Amsterdam", gap).get("2026-10-14")?.anomalyC,
    ).toBeNull();
    const dark = baselines({
      normals: {
        ...baselines().normals!,
        days: { "2026-10-14": normalDay(12, 1) },
      },
    });
    expect(
      compareDays(hours, "Europe/Amsterdam", dark).get("2026-10-14")
        ?.solarAnomalyPct,
    ).toBeNull();
    const elsewhere = compareDays(
      hours,
      "Europe/Amsterdam",
      baselines({ timezone: "UTC" }),
    );
    expect(elsewhere.get("2026-10-14")).toMatchObject({
      anomalyC: null,
      revisionC: 1,
    });
    expect(
      normalSeries(hours, "Europe/Amsterdam", baselines({ timezone: "UTC" })),
    ).toBeNull();
    expect(normalSeries(hours, "Europe/Amsterdam", baselines())?.[0]).toBe(12);
    expect(
      compareDays(hours, "Europe/Amsterdam", null).get("2026-10-14"),
    ).toEqual({
      anomalyC: null,
      solarAnomalyPct: null,
      revisionC: null,
      revisionKwhM2: null,
    });
  });
});
