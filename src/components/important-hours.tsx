"use client";
import { useId } from "react";
import type { Forecast, Signal } from "@/features/weather/types";
import { formatNumber, HOUR, localDate, localTime } from "@/lib/time";

export function signalValue(signal: Signal) {
  if (signal.kind === "solar") return `${formatNumber(signal.value, 0)} W/m²`;
  if (signal.kind === "window") return `${signal.value} hours`;
  return `${signal.kind === "ramp" && signal.value > 0 ? "+" : ""}${formatNumber(signal.value)} °C`;
}
export function ImportantHours({
  forecast,
  selectedTime,
  onInspect,
}: {
  forecast: Forecast;
  selectedTime: number | null;
  onInspect: (time: number) => void;
}) {
  const id = useId();
  const zone = forecast.location.timezone;
  const at = (t: number) => `${localDate(t, zone)}, ${localTime(t, zone)}`;
  const between = (a: number, b: number) =>
    localDate(a, zone) === localDate(b, zone)
      ? `${at(a)}-${localTime(b, zone)}`
      : `${at(a)} to ${at(b)}`;
  return (
    <section className="important-hours" aria-labelledby={id}>
      <div className="section-heading">
        <h2 id={id}>Hours to watch</h2>
      </div>
      {forecast.signals.map((signal) => (
        <button
          className="signal"
          key={signal.kind}
          aria-pressed={selectedTime === signal.time}
          onClick={() => onInspect(signal.time)}
        >
          <strong>{signal.title}</strong>
          <b>{signalValue(signal)}</b>
          <small>
            {signal.kind === "solar"
              ? `${between(signal.time - HOUR, signal.time)} mean`
              : signal.kind === "window"
                ? `${between(signal.time - HOUR, signal.endTime!)}, at least 100 W/m²`
                : signal.kind === "ramp"
                  ? between(signal.time, signal.endTime!)
                  : at(signal.time)}
          </small>
        </button>
      ))}
      {!forecast.signals.some((s) => s.kind === "solar") && (
        <p className="helper">
          {forecast.coverage.solar
            ? "No positive irradiance in this window."
            : "Solar irradiance is unavailable in this window."}
        </p>
      )}
      <details className="method">
        <summary>How these hours are chosen</summary>
        <div>
          <p>
            Extremes use available hours; the earliest hour wins a tie. The
            largest three-hour change needs four consecutive temperatures.
          </p>
          <p>
            Solar peak is the highest hourly mean. The solar window is the
            longest run of two or more hours at or above 100 W/m², an
            exploration threshold rather than a generation estimate.
          </p>
        </div>
      </details>
    </section>
  );
}
