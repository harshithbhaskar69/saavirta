import {
  ENSEMBLE_HOURS,
  ENSEMBLE_MEMBERS,
  type EnsembleSnapshot,
  summarizeEnsemble,
} from "../../src/features/weather/uncertainty";
import { HOUR } from "../../src/lib/time";
import type { Horizon } from "../../src/features/weather/types";

/** Synthetic member trajectories; not a captured forecast or evidence of calibration. */
export function ensembleSnapshot(
  start: number,
  timezone = "Europe/Helsinki",
): EnsembleSnapshot {
  return {
    version: 1,
    timezone,
    retrievedAt: start,
    time: Array.from({ length: ENSEMBLE_HOURS }, (_, i) => start + i * HOUR),
    members: Array.from({ length: ENSEMBLE_MEMBERS }, (_, m) => ({
      temperatureC: Array.from({ length: ENSEMBLE_HOURS }, (_, i) =>
        Number((10 + Math.sin(i / 4) * 3 + (m - 25) / 10).toFixed(1)),
      ),
      solarIrradianceWm2: Array.from({ length: ENSEMBLE_HOURS }, (_, i) =>
        Math.round(
          Math.max(0, Math.sin((((i % 24) - 6) * Math.PI) / 12)) *
            (200 + m * 8),
        ),
      ),
    })),
  };
}

export function ensembleProvider(snapshot: EnsembleSnapshot) {
  const hourly: Record<string, (number | null)[]> = {
    time: snapshot.time.map((t) => t / 1000),
  };
  const hourly_units: Record<string, string> = { time: "unixtime" };
  snapshot.members.forEach((member, i) => {
    const suffix = i === 0 ? "" : `_member${String(i).padStart(2, "0")}`;
    hourly[`temperature_2m${suffix}`] = member.temperatureC;
    hourly[`shortwave_radiation${suffix}`] = member.solarIrradianceWm2;
    hourly_units[`temperature_2m${suffix}`] = "°C";
    hourly_units[`shortwave_radiation${suffix}`] = "W/m²";
  });
  return { timezone: snapshot.timezone, hourly, hourly_units };
}

export function uncertainty(
  start: number,
  horizon: Horizon = "48h",
  timezone = "Europe/Amsterdam",
) {
  return summarizeEnsemble(
    ensembleSnapshot(start, timezone),
    start,
    horizon,
    start,
  );
}
