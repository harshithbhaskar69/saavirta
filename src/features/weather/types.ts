export const HORIZONS = { "24h": 24, "48h": 48, "7d": 168 } as const;
export type Horizon = keyof typeof HORIZONS;
export type Point = { latitude: number; longitude: number };
export type Place = Point & {
  name: string;
  region?: string;
  country?: string;
  countryCode?: string;
  private?: boolean;
};
export type Hour = {
  time: number;
  temperatureC: number | null;
  solarIrradianceWm2: number | null;
  windSpeedMs: number | null;
  windGustMs: number | null;
  cloudCoverPct: number | null;
  humidityPct: number | null;
  precipitationMm: number | null;
  precipitationProbabilityPct: number | null;
};
export type CurrentConditions = {
  time: number;
  temperatureC: number | null;
  weatherCode: number | null;
  isDay: boolean;
};
export type Snapshot = {
  version: 2;
  location: Point & {
    timezone: string;
    timezoneResolved: boolean;
    grid: Point;
  };
  retrievedAt: number;
  hourly: Hour[];
  current: CurrentConditions | null;
};
export type Signal = {
  kind: "cold" | "warm" | "ramp" | "solar" | "window";
  title: string;
  time: number;
  endTime?: number;
  value: number;
};
export type Forecast = {
  location: Snapshot["location"];
  units: {
    temperature: "°C";
    solarIrradiance: "W/m²";
    time: "unix_milliseconds";
    solarInterval: "preceding_hour_mean";
    wind: "m/s";
    precipitation: "mm";
    percentage: "%";
  };
  horizon: Horizon;
  hourly: Hour[];
  current: CurrentConditions | null;
  source: {
    provider: "Open-Meteo";
    retrievedAt: number;
    servedAt: number;
    ageSeconds: number;
    stale: boolean;
    refreshFailed: boolean;
  };
  coverage: { expected: number; temperature: number; solar: number };
  signals: Signal[];
};
export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    retryable: boolean;
    requestId: string;
  };
};
/** Mean of the same local date and hour over past years; index = local hour 0-23. */
export type HourlyNormal = {
  temperatureC: (number | null)[];
  solarIrradianceWm2: (number | null)[];
};
export type Normals = {
  source: "ERA5 and ERA5-Land reanalysis";
  years: [number, number];
  /** Years that actually contributed; fewer than the span when a year was unavailable. */
  yearCount: number;
  smoothingDays: number;
  days: Record<string, HourlyNormal>;
};
/** One valid hour from two runs of the same model, 24 hours apart. */
export type RunHour = {
  time: number;
  latestC: number | null;
  previousC: number | null;
  latestWm2: number | null;
  previousWm2: number | null;
};
export type Revision = {
  model: "ECMWF IFS 9 km";
  latestRun: number;
  previousRun: number;
  hours: RunHour[];
};
export type Baselines = {
  timezone: string;
  normals: Normals | null;
  revision: Revision | null;
};
