import { HOUR } from "@/lib/time";
import type { Hour, Signal } from "./types";

export function deriveSignals(hours: Hour[]): Signal[] {
  const signals: Signal[] = [];
  const temperatures = hours.filter(
    (h): h is Hour & { temperatureC: number } => h.temperatureC !== null,
  );
  if (temperatures.length) {
    const cold = temperatures.reduce((a, b) =>
      a.temperatureC <= b.temperatureC ? a : b,
    );
    const warm = temperatures.reduce((a, b) =>
      a.temperatureC >= b.temperatureC ? a : b,
    );
    signals.push(
      {
        kind: "cold",
        title: "Coldest hour",
        time: cold.time,
        value: cold.temperatureC,
      },
      {
        kind: "warm",
        title: "Warmest hour",
        time: warm.time,
        value: warm.temperatureC,
      },
    );
  }
  let ramp: Signal | undefined;
  for (let i = 3; i < hours.length; i++) {
    const window = hours.slice(i - 3, i + 1);
    if (
      window.some((h) => h.temperatureC === null) ||
      window.some((h, j) => j > 0 && h.time - window[j - 1].time !== HOUR)
    )
      continue;
    const value = hours[i].temperatureC! - hours[i - 3].temperatureC!;
    if (!ramp || Math.abs(value) > Math.abs(ramp.value))
      ramp = {
        kind: "ramp",
        title: "Largest 3h change",
        time: hours[i - 3].time,
        endTime: hours[i].time,
        value,
      };
  }
  if (ramp) signals.push(ramp);
  const solar = hours.filter(
    (h): h is Hour & { solarIrradianceWm2: number } =>
      h.solarIrradianceWm2 !== null && h.solarIrradianceWm2 > 0,
  );
  if (solar.length) {
    const peak = solar.reduce((a, b) =>
      a.solarIrradianceWm2 >= b.solarIrradianceWm2 ? a : b,
    );
    signals.push({
      kind: "solar",
      title: "Solar peak",
      time: peak.time,
      value: peak.solarIrradianceWm2,
    });
  }
  let start = 0,
    length = 0,
    bestStart = 0,
    bestLength = 0;
  for (let i = 0; i < hours.length; i++) {
    if ((hours[i].solarIrradianceWm2 ?? -1) < 100) {
      length = 0;
      continue;
    }
    if (length === 0 || hours[i].time - hours[i - 1].time !== HOUR) {
      start = i;
      length = 0;
    }
    length++;
    if (length > bestLength) {
      bestLength = length;
      bestStart = start;
    }
  }
  if (bestLength >= 2)
    signals.push({
      kind: "window",
      title: "Solar window",
      time: hours[bestStart].time,
      endTime: hours[bestStart + bestLength - 1].time,
      value: bestLength,
    });
  return signals;
}
