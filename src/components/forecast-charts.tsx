"use client";
import {
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  ReferenceArea,
  ReferenceLine,
  ReferenceDot,
} from "recharts";
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import type { Baselines, Forecast, Hour } from "@/features/weather/types";
import {
  forecastCsv,
  localDays,
  normalSeries,
  relativeDays,
} from "@/features/weather/overview";
import {
  formatNumber,
  HOUR,
  hourLabel,
  localClock,
  localDate,
  localTime,
  offset,
} from "@/lib/time";
import { show } from "./daily-summary";
import { AnimatedBackground } from "./motion/animated-background";

const HALF_HOUR = HOUR / 2;
// Plot geometry shared by both charts and the scrubber: value axis on the trailing side.
const MARGIN_LEFT = 4,
  AXIS_WIDTH = 44;
const STEPS: Record<string, number> = {
  ArrowLeft: -1,
  ArrowDown: -1,
  ArrowRight: 1,
  ArrowUp: 1,
  PageDown: -24,
  PageUp: 24,
};

export function ForecastCharts({
  forecast,
  baselines,
  selectedTime,
  onInspect,
  focusDay,
  onFocusDay,
}: {
  forecast: Forecast;
  baselines: Baselines | undefined;
  selectedTime: number | null;
  onInspect: (time: number) => void;
  focusDay: string | null;
  onFocusDay: (day: string | null) => void;
}) {
  const id = useId(),
    [rows, setRows] = useState(24);
  const solarBlock = useRef<HTMLDivElement>(null),
    dragging = useRef(false);
  const {
    hourly,
    location: { timezone },
  } = forecast;
  const days = useMemo(() => localDays(hourly, timezone), [hourly, timezone]);
  const focused = days.find((d) => d.key === focusDay);
  // A focused day shows its own instants and the solar intervals that start in it.
  const instants = focused?.instants ?? hourly,
    intervals = focused?.intervals ?? hourly;
  const normals = useMemo(
    () => normalSeries(hourly, timezone, baselines),
    [hourly, timezone, baselines],
  );
  const { ticks, dayStarts, temperature, solar } = useMemo(() => {
    const clock = localClock(timezone);
    const ticks: number[] = [],
      dayStarts = new Set<number>();
    let previous = "";
    for (const h of instants) {
      const { day, hour } = clock(h.time);
      if (previous && day !== previous) dayStarts.add(h.time);
      if (
        focused
          ? hour % 3 === 0
          : instants.length > 48
            ? dayStarts.has(h.time)
            : hour % 6 === 0
      )
        ticks.push(h.time);
      previous = day;
    }
    const normalAt = new Map(
      normals?.map((value, i) => [hourly[i].time, value]),
    );
    return {
      ticks,
      dayStarts,
      temperature: instants.map((h) => ({
        ...h,
        normalC: normalAt.get(h.time) ?? null,
      })),
      // Irradiance is the preceding hour's mean: draw each bar across that hour.
      solar: intervals.map((h) => ({ ...h, mid: h.time - HALF_HOUR })),
    };
  }, [instants, intervals, focused, normals, hourly, timezone]);
  // A final midnight sample can have no preceding-hour intervals in its own day.
  const domain: [number, number] = [
    Math.min(
      instants[0].time,
      intervals[0] ? intervals[0].time - HOUR : instants[0].time - HALF_HOUR,
    ),
    Math.max(
      instants.at(-1)!.time,
      intervals.at(-1)?.time ?? instants.at(-1)!.time + HALF_HOUR,
    ),
  ];
  const index = Math.max(
      0,
      instants.findIndex((h) => h.time === selectedTime),
    ),
    selected: Hour = instants[index];
  // The line is two series meeting at the cursor's sample: full strength up to
  // it, a shade lighter after it. Linear segments make the split exact.
  const split = useMemo(
    () =>
      temperature.map((h, i) => ({
        ...h,
        toCursor: i <= index ? h.temperatureC : null,
        fromCursor: i >= index ? h.temperatureC : null,
      })),
    [temperature, index],
  );
  const normalNow = normals?.[hourly.indexOf(selected)] ?? null;
  const dayLabel = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
  });
  const names = relativeDays(
    days.map((d) => d.key),
    hourly[0].time,
    timezone,
  );
  const axis = (dataKey: "time" | "mid") => (
    <XAxis
      dataKey={dataKey}
      type="number"
      scale="time"
      domain={domain}
      ticks={ticks}
      tickFormatter={(value: number) =>
        dayStarts.has(value) && !focused
          ? dayLabel.format(value)
          : localTime(value, timezone)
      }
      axisLine={false}
      tickLine={false}
      minTickGap={18}
      tickMargin={10}
    />
  );
  const dayLines = [...dayStarts].map((t) => (
    <ReferenceLine key={t} x={t} stroke="var(--border)" />
  ));
  const cursor = (
    <ReferenceLine
      x={selected.time}
      stroke="var(--muted)"
      strokeDasharray="3 4"
    />
  );
  // Pointer position to an hour: nearest sample over temperature; over solar, the
  // hour whose preceding-hour interval contains the pointer.
  const pick = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const width = box.width - MARGIN_LEFT - AXIS_WIDTH;
    const at =
      domain[0] +
      ((event.clientX - box.left - MARGIN_LEFT) / width) *
        (domain[1] - domain[0]);
    const overSolar =
      event.clientY >=
      (solarBlock.current?.getBoundingClientRect().top ?? Infinity);
    const steps = (at - instants[0].time) / HOUR;
    const i = Math.min(
      instants.length - 1,
      Math.max(0, overSolar ? Math.ceil(steps) : Math.round(steps)),
    );
    if (instants[i].time !== selectedTime) onInspect(instants[i].time);
  };
  const step = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = instants.length - 1;
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? last
          : event.key in STEPS
            ? Math.min(last, Math.max(0, index + STEPS[event.key]))
            : null;
    if (next === null) return;
    event.preventDefault();
    onInspect(instants[next].time);
  };
  const interval = `${localTime(selected.time - HOUR, timezone)}-${localTime(selected.time, timezone)}`;
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([forecastCsv(hourly, timezone)], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "saavirta-hourly-forecast.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <section className="hourly" id="hourly" aria-labelledby={`${id}-title`}>
      <div className="section-heading">
        <h2 id={`${id}-title`}>Hourly forecast</h2>
        <button className="text-button" onClick={download}>
          <DownloadSimpleIcon />
          Export CSV
        </button>
      </div>
      <div
        className="day-strip segmented"
        role="group"
        aria-label="Hours shown"
      >
        <AnimatedBackground value={focused ? focused.key : "all"}>
          {[
            <button
              key="all"
              data-id="all"
              aria-pressed={!focused}
              onClick={() => onFocusDay(null)}
            >
              All
            </button>,
            ...days.map((day, i) => (
              <button
                key={day.key}
                data-id={day.key}
                aria-pressed={focused?.key === day.key}
                onClick={() => onFocusDay(day.key)}
              >
                {names[i] ?? dayLabel.format(day.instants[0].time)}
              </button>
            )),
          ]}
        </AnimatedBackground>
      </div>
      <div className="readout">
        <div className="inspection-time">
          <strong>
            {localDate(selected.time, timezone)},{" "}
            {localTime(selected.time, timezone)}
          </strong>
          <small>
            {timezone} ({offset(selected.time, timezone)})
          </small>
        </div>
        <div className="inspection-value temperature">
          {formatNumber(selected.temperatureC)}
          <small>{selected.temperatureC === null ? "temperature" : "°C"}</small>
        </div>
        <div className="inspection-value irradiance">
          {formatNumber(selected.solarIrradianceWm2, 0)}
          <small>
            {selected.solarIrradianceWm2 === null ? "irradiance" : "W/m²"}, mean{" "}
            {interval}
          </small>
        </div>
        <dl className="readout-context">
          {normals && (
            <div>
              <dt>Normal</dt>
              <dd>
                {show(normalNow)}
                {normalNow !== null && " °C"}
              </dd>
            </div>
          )}
          <div>
            <dt>Wind</dt>
            <dd>
              {show(selected.windSpeedMs)}
              {selected.windSpeedMs !== null && " m/s"}
            </dd>
          </div>
          <div>
            <dt>Cloud</dt>
            <dd>
              {show(selected.cloudCoverPct, 0)}
              {selected.cloudCoverPct !== null && "%"}
            </dd>
          </div>
          <div>
            <dt>Rain</dt>
            <dd>
              {show(selected.precipitationMm)}
              {selected.precipitationMm !== null && " mm"}
            </dd>
          </div>
        </dl>
      </div>
      <div className="plots">
        <div className="chart-block">
          <h3 className="chart-title">
            <span className="series-mark" aria-hidden="true" />
            Temperature <small>°C at 2 m</small>
            {normals && (
              <span className="chart-legend">
                <span className="series-mark normal" aria-hidden="true" />
                Normal
              </span>
            )}
          </h3>
          <div className="chart-canvas" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart
                data={split}
                margin={{ left: MARGIN_LEFT, right: 0, top: 8, bottom: 0 }}
                accessibilityLayer={false}
              >
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                {axis("time")}
                <YAxis
                  orientation="right"
                  width={AXIS_WIDTH}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}°`}
                  domain={["auto", "auto"]}
                />
                {dayLines}
                {normals && (
                  <Line
                    type="linear"
                    dataKey="normalC"
                    stroke="var(--muted)"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                    activeDot={false}
                    isAnimationActive={false}
                    connectNulls={false}
                  />
                )}
                {(
                  [
                    // 70% keeps the lighter part above 3:1 in both themes.
                    [
                      "fromCursor",
                      "color-mix(in srgb, var(--temp) 70%, var(--bg))",
                    ],
                    ["toCursor", "var(--temp)"],
                  ] as const
                ).map(([key, stroke]) => (
                  <Line
                    key={key}
                    type="linear"
                    dataKey={key}
                    stroke={stroke}
                    strokeWidth={2}
                    dot={false}
                    activeDot={false}
                    isAnimationActive={false}
                    connectNulls={false}
                  />
                ))}
                {cursor}
                {selected.temperatureC !== null && (
                  <ReferenceDot
                    x={selected.time}
                    y={selected.temperatureC}
                    r={4}
                    fill="var(--temp)"
                    stroke="var(--surface)"
                    strokeWidth={2}
                    ifOverflow="hidden"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="chart-block" ref={solarBlock}>
          <h3 className="chart-title">
            <span className="series-mark solar" aria-hidden="true" />
            Solar irradiance <small>W/m², mean of each hour</small>
          </h3>
          <div className="chart-canvas solar" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart
                data={solar}
                margin={{ left: MARGIN_LEFT, right: 0, top: 8, bottom: 0 }}
                accessibilityLayer={false}
                barCategoryGap="18%"
              >
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                {axis("mid")}
                <YAxis
                  orientation="right"
                  width={AXIS_WIDTH}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  domain={[0, "auto"]}
                />
                {dayLines}
                <ReferenceArea
                  x1={selected.time - HOUR}
                  x2={selected.time}
                  fill="var(--solar-fill)"
                  fillOpacity={0.14}
                  ifOverflow="hidden"
                />
                <Bar
                  dataKey="solarIrradianceWm2"
                  fill="var(--solar-fill)"
                  isAnimationActive={false}
                  radius={[1, 1, 0, 0]}
                >
                  {/* Hours up to the cursor at full strength, later ones a tad
                      lighter: 85% is as light as the fill goes and keeps 3:1. */}
                  {solar.map((h) => (
                    <Cell
                      key={h.time}
                      fill={
                        h.time > selected.time
                          ? "color-mix(in srgb, var(--solar-fill) 85%, var(--bg))"
                          : "var(--solar-fill)"
                      }
                    />
                  ))}
                </Bar>
                {cursor}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        {/* The plots are the scrubber: pointer, touch drag and keys select an hour. */}
        <div
          className="scrubber"
          role="slider"
          tabIndex={0}
          aria-label="Forecast hour"
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={instants.length - 1}
          aria-valuenow={index}
          aria-valuetext={`${hourLabel(selected.time, timezone)}; ${formatNumber(selected.temperatureC)} degrees Celsius; ${formatNumber(selected.solarIrradianceWm2, 0)} watts per square metre`}
          aria-keyshortcuts="ArrowLeft ArrowRight PageUp PageDown Home End"
          onKeyDown={step}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            dragging.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            pick(event);
          }}
          onPointerMove={(event) => {
            if (dragging.current || event.pointerType === "mouse") pick(event);
          }}
          onPointerUp={() => (dragging.current = false)}
          onPointerCancel={() => (dragging.current = false)}
        />
      </div>
      <p className="scrub-hint">
        <span className="hint-pointer">
          Hover or drag across the charts. When focused, ← → step an hour and
          Page Up/Down a day.
        </span>
        <span className="hint-touch">
          Drag across the charts to inspect an hour.
        </span>
      </p>
      <details className="hourly-table">
        <summary>View hourly data</summary>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">
              Hourly forecast in {timezone}. Solar values describe the preceding
              hour.
            </caption>
            <thead>
              <tr>
                <th scope="col">Local hour</th>
                <th scope="col">Temperature °C</th>
                <th scope="col">Solar mean W/m²</th>
                <th scope="col">Wind 10m m/s</th>
                <th scope="col">Gust max m/s</th>
                <th scope="col">Cloud %</th>
                <th scope="col">Humidity %</th>
                <th scope="col">Precip. mm</th>
                <th scope="col">Precip. chance %</th>
              </tr>
            </thead>
            <tbody>
              {hourly.slice(0, rows).map((h) => (
                <tr key={h.time}>
                  <th scope="row">{hourLabel(h.time, timezone)}</th>
                  <td>{formatNumber(h.temperatureC)}</td>
                  <td>{formatNumber(h.solarIrradianceWm2, 0)}</td>
                  <td>{formatNumber(h.windSpeedMs)}</td>
                  <td>{formatNumber(h.windGustMs)}</td>
                  <td>{formatNumber(h.cloudCoverPct, 0)}</td>
                  <td>{formatNumber(h.humidityPct, 0)}</td>
                  <td>{formatNumber(h.precipitationMm)}</td>
                  <td>{formatNumber(h.precipitationProbabilityPct, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows < hourly.length && (
          <button
            className="text-button"
            onClick={() => setRows((n) => n + 24)}
          >
            Show 24 more hours
          </button>
        )}
      </details>
    </section>
  );
}
