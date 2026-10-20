"use client";
import { useId, useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Hour } from "@/features/weather/types";
import { localDays, windHighlights } from "@/features/weather/overview";
import {
  formatNumber,
  HOUR,
  hourLabel,
  localClock,
  localTime,
  offset,
  solarInterval,
} from "@/lib/time";
import type { ConditionMetric } from "./daily-conditions";

interface Plot {
  field: Exclude<keyof Hour, "time" | "temperatureC">;
  label: string;
  unit: string;
  meaning: string;
  interval?: boolean;
}

const plots: Record<ConditionMetric, Plot[]> = {
  wind: [
    {
      field: "windSpeedMs",
      label: "Wind speed at 10 m",
      unit: "m/s",
      meaning: "Hourly sample",
    },
    {
      field: "windGustMs",
      label: "Gusts at 10 m",
      unit: "m/s",
      meaning: "Maximum during each hour",
      interval: true,
    },
  ],
  cloud: [
    {
      field: "cloudCoverPct",
      label: "Cloud cover",
      unit: "%",
      meaning: "Hourly sample",
    },
    {
      field: "solarIrradianceWm2",
      label: "Solar irradiance",
      unit: "W/m²",
      meaning: "Mean during each hour",
      interval: true,
    },
  ],
  humidity: [
    {
      field: "humidityPct",
      label: "Relative humidity",
      unit: "%",
      meaning: "Hourly sample",
    },
  ],
  precipitation: [
    {
      field: "precipitationMm",
      label: "Precipitation",
      unit: "mm",
      meaning: "Total during each hour",
      interval: true,
    },
    {
      field: "precipitationProbabilityPct",
      label: "Precipitation chance",
      unit: "%",
      meaning: "Chance of more than 0.1 mm during each hour",
      interval: true,
    },
  ],
};

const context: Record<ConditionMetric, string> = {
  wind: "Local wind context. For Finland-wide generation in MW, use the wind forecast in Energy Markets.",
  cloud:
    "Read cloud timing alongside irradiance when reviewing local solar conditions. Irradiance is not PV output.",
  humidity:
    "Read with temperature when reviewing local cooling conditions. Humidity alone does not estimate electricity demand.",
  precipitation:
    "Local rain, showers and snow water equivalent. Hydropower analysis needs regional catchment and inflow data.",
};

export function ConditionForecast({
  metric,
  hours,
  dayKey,
  timezone,
  selectedTime,
  onInspect,
}: {
  metric: ConditionMetric;
  hours: Hour[];
  dayKey: string;
  timezone: string;
  selectedTime: number | null;
  onInspect: (time: number) => void;
}) {
  const id = useId();
  const day = useMemo(
    () => localDays(hours, timezone).find((value) => value.key === dayKey),
    [hours, timezone, dayKey],
  );
  if (!day) return <p>No forecast hours for this day.</p>;
  const { instants, intervals } = day;
  const selection = [
    ...new Set([...instants, ...intervals].map((hour) => hour.time)),
  ].sort((a, b) => a - b);
  const index = Math.max(0, selection.indexOf(selectedTime ?? selection[0]));
  const time = selection[index];
  const domain: [number, number] = [
    Math.min(
      instants[0].time,
      intervals[0] ? intervals[0].time - HOUR : instants[0].time,
    ),
    Math.max(
      instants.at(-1)!.time,
      intervals.at(-1)?.time ?? instants.at(-1)!.time,
    ) + (selection.length === 1 ? HOUR : 0),
  ];
  const clock = localClock(timezone);
  const ticks = selection.filter((value) => clock(value).hour % 3 === 0);
  const repeatedHour =
    offset(domain[0], timezone) !== offset(domain[1], timezone);
  // The next midnight is a real endpoint sample, not part of this day's extremes.
  const plotInstants = hours.filter(
    (hour) => hour.time >= domain[0] && hour.time <= domain[1],
  );
  const fields = plots[metric];
  const reading = (plot: Plot, at: number): string => {
    const value = (plot.interval ? intervals : plotInstants).find(
      (hour) => hour.time === at,
    )?.[plot.field];
    return value == null
      ? "Unavailable"
      : `${formatNumber(value, plot.unit === "%" || plot.unit === "W/m²" ? 0 : 1)} ${plot.unit}`;
  };
  const description = fields
    .map(
      (plot) =>
        `${plot.label}: ${reading(plot, time)}${plot.interval ? `, ${solarInterval(time, timezone)}` : ""}`,
    )
    .join("; ");
  const highlights =
    metric === "wind" ? windHighlights(instants, intervals) : [];

  return (
    <div className="condition-forecast">
      <p className="condition-context">{context[metric]}</p>
      {highlights.length > 0 && (
        <div
          className="condition-highlights"
          role="group"
          aria-label="Wind hours to inspect"
        >
          {highlights.map((highlight) => (
            <button
              type="button"
              key={highlight.label}
              onClick={() => onInspect(highlight.time)}
              aria-pressed={time === highlight.time}
            >
              <span>{highlight.label}</span>
              <strong>{formatNumber(highlight.value)} m/s</strong>
              <small>
                {highlight.precedingHour
                  ? solarInterval(highlight.time, timezone)
                  : `${localTime(highlight.time, timezone)} ${offset(highlight.time, timezone)}`}
              </small>
            </button>
          ))}
        </div>
      )}
      <div className="condition-inspection">
        <label htmlFor={`${id}-hour`}>
          Inspect hour <strong>{hourLabel(time, timezone)}</strong>
        </label>
        <input
          id={`${id}-hour`}
          type="range"
          min={0}
          max={selection.length - 1}
          value={index}
          disabled={selection.length === 1}
          aria-label="Condition forecast hour"
          aria-valuetext={`${hourLabel(time, timezone)}; ${description}`}
          onChange={(event) =>
            onInspect(selection[Number(event.currentTarget.value)])
          }
        />
      </div>
      <div className="condition-plots">
        {fields.map((plot) => {
          const data = (plot.interval ? intervals : plotInstants).map(
            (hour) => ({
              ...hour,
              x: plot.interval ? hour.time - HOUR / 2 : hour.time,
            }),
          );
          const Chart = plot.interval ? BarChart : LineChart;
          const solar = plot.field === "solarIrradianceWm2";
          return (
            <section
              key={plot.field}
              className="condition-plot"
              aria-label={plot.label}
            >
              <div className="condition-plot-heading">
                <h5>
                  {plot.label} <small>{plot.unit}</small>
                </h5>
                <strong>{reading(plot, time)}</strong>
              </div>
              <p className="condition-plot-time">
                {plot.meaning} ·{" "}
                {plot.interval
                  ? solarInterval(time, timezone)
                  : `${localTime(time, timezone)} ${offset(time, timezone)}`}
              </p>
              {data.some((hour) => hour[plot.field] !== null) ? (
                <div className="condition-chart-canvas" aria-hidden="true">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <Chart
                      data={data}
                      margin={{ left: 4, right: 0, top: 8, bottom: 0 }}
                      accessibilityLayer={false}
                      onMouseMove={(state) => {
                        if (typeof state.activeLabel === "number")
                          onInspect(
                            state.activeLabel + (plot.interval ? HOUR / 2 : 0),
                          );
                      }}
                      onClick={(state) => {
                        if (typeof state.activeLabel === "number")
                          onInspect(
                            state.activeLabel + (plot.interval ? HOUR / 2 : 0),
                          );
                      }}
                    >
                      <Tooltip content={() => null} cursor={false} />
                      <CartesianGrid vertical={false} stroke="var(--grid)" />
                      <XAxis
                        type="number"
                        dataKey="x"
                        domain={domain}
                        ticks={ticks}
                        tickFormatter={(value: number) =>
                          localTime(
                            value,
                            timezone,
                            repeatedHour ? { timeZoneName: "shortOffset" } : {},
                          )
                        }
                        axisLine={false}
                        tickLine={false}
                        tickMargin={12}
                        height={40}
                        minTickGap={20}
                      />
                      <YAxis
                        orientation="right"
                        width={44}
                        axisLine={false}
                        tickLine={false}
                        tickMargin={8}
                        domain={plot.unit === "%" ? [0, 100] : [0, "auto"]}
                      />
                      {plot.interval && (
                        <ReferenceArea
                          x1={Math.max(domain[0], time - HOUR)}
                          x2={time}
                          fill="var(--accent)"
                          fillOpacity={0.08}
                        />
                      )}
                      {plot.interval ? (
                        <Bar
                          dataKey={plot.field}
                          fill={solar ? "var(--solar-fill)" : "var(--accent)"}
                          isAnimationActive={false}
                        />
                      ) : (
                        <Line
                          dataKey={plot.field}
                          type="linear"
                          stroke="var(--ink)"
                          strokeWidth={2}
                          dot={data.length === 1}
                          activeDot={false}
                          connectNulls={false}
                          isAnimationActive={false}
                        />
                      )}
                      <ReferenceLine
                        x={time}
                        stroke="var(--muted)"
                        strokeDasharray="3 4"
                      />
                    </Chart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="condition-chart-empty">
                  No {plot.label.toLowerCase()} data for these forecast hours.
                </p>
              )}
            </section>
          );
        })}
      </div>
      <p className="condition-note">
        Open-Meteo · Forecast hours for the selected point and day. Missing
        values stay unavailable.
        {metric === "wind" &&
          " Extremes use available hours; the first occurrence is shown when values tie."}
      </p>
      <details className="hourly-table">
        <summary>
          View {metric === "cloud" ? "cloud and irradiance" : metric} hourly
          values
        </summary>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">
              {metric} forecast hours in {timezone}. Interval values describe
              the preceding hour.
            </caption>
            <thead>
              <tr>
                <th scope="col">Sample time / hour ending</th>
                {fields.map((plot) => (
                  <th scope="col" key={plot.field}>
                    {plot.label} ({plot.unit})
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {selection.map((at) => (
                <tr key={at}>
                  <th scope="row">{hourLabel(at, timezone)}</th>
                  {fields.map((plot) => (
                    <td key={plot.field}>{reading(plot, at)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
