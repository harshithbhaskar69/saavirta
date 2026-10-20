"use client";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowClockwiseIcon,
  CaretDownIcon,
  CheckIcon,
  DownloadSimpleIcon,
} from "@phosphor-icons/react";
import type { Forecast, Place } from "@/features/weather/types";
import { InfoTip } from "@/components/info-tip";
import { useMarkets } from "./use-markets";
import { MetricCard } from "./metric-card";
import type { Dashboard, MarketSeries, MarketSettings } from "./contracts";
import {
  deliveryLabel,
  intervalAt,
  marketCsv,
  weatherAt,
  visibleDashboard,
  deliveryAxis,
} from "./presentation";
import { helsinkiDate, shiftDate } from "./state";

const number = (value: number | null | undefined, digits = 0) =>
  value == null
    ? "Unavailable"
    : new Intl.NumberFormat("en-GB", { maximumFractionDigits: digits }).format(
        value,
      );
const groups = [
  {
    title: "Demand",
    ids: ["consumption-actual", "consumption-forecast"],
    unit: "MW",
  },
  {
    title: "Generation",
    ids: ["production-actual", "production-forecast"],
    unit: "MW",
  },
  {
    title: "Wind & solar forecasts",
    ids: ["wind-forecast", "solar-forecast"],
    unit: "MW",
  },
  { title: "Day-ahead prices", ids: ["day-ahead-price"], unit: "EUR/MWh" },
];

function ChartRow({
  title,
  series,
  unit,
  domain,
  time,
  inspect,
  price = false,
  axis,
}: {
  title: string;
  series: MarketSeries[];
  unit: string;
  domain: [number, number];
  time: number;
  inspect: (time: number) => void;
  price?: boolean;
  axis: ReturnType<typeof deliveryAxis>;
}) {
  const rows = useMemo(() => {
    const points = new Map<number, Record<string, number | null>>();
    for (const s of series)
      for (const p of s.intervals) {
        const x = Date.parse(p.start);
        const row = points.get(x) ?? { time: x };
        row[s.id] = p.value;
        points.set(x, row);
      }
    const ordered = [...points.values()].sort((a, b) => a.time! - b.time!);
    if (price && ordered.length)
      ordered.push({ ...ordered[ordered.length - 1], time: domain[1] });
    return ordered;
  }, [series, price, domain]);
  const usable = series.some((s) => s.quality.coverage > 0);
  return (
    <section className="market-chart" aria-label={title}>
      <div className="market-chart-heading">
        <div className="market-chart-title">
          <h3>{title}</h3>
          {series.some((s) => s.id === "consumption-forecast") && (
            <InfoTip label="About the consumption forecast">
              <h4>Finland's national demand forecast</h4>
              <p>
                Fingrid produces the consumption forecast (dataset 166) from
                historical consumption and weather forecasts. It covers the next
                72 hours in 15-minute periods and is updated every 15 minutes.
              </p>
              <p>
                Actual consumption uses Fingrid dataset 124. Säävirta aligns
                these series and calculates changes and errors against earlier
                collected forecasts; it does not forecast your customers'
                demand.
              </p>
              <a
                href="https://data.fingrid.fi/en/datasets/166"
                target="_blank"
                rel="noreferrer"
              >
                Fingrid forecast methodology
              </a>
            </InfoTip>
          )}
        </div>
        <span>{unit}</span>
      </div>
      <div className="market-legend">
        {series.map((s, i) => (
          <span
            key={s.id}
            data-dashed={s.classification === "forecast"}
            style={{ color: i === 1 ? "var(--solar)" : "var(--ink)" }}
          >
            {s.label}
            {s.id === "consumption-forecast" || s.id === "consumption-actual"
              ? " · Fingrid"
              : ""}{" "}
            <small>
              · {s.quality.availability}
              {s.quality.freshness === "stale" ? " · stale" : ""}
            </small>
          </span>
        ))}
      </div>
      {usable ? (
        <div className="market-chart-canvas" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={rows}
              margin={{ left: 0, right: 18, top: 8, bottom: 0 }}
              accessibilityLayer={false}
              onMouseMove={(state) => {
                if (typeof state.activeLabel === "number")
                  inspect(state.activeLabel);
              }}
              onClick={(state) => {
                if (typeof state.activeLabel === "number")
                  inspect(state.activeLabel);
              }}
            >
              <Tooltip content={() => null} cursor={false} />
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis
                type="number"
                dataKey="time"
                domain={domain}
                ticks={axis.ticks}
                tickFormatter={axis.label}
                interval="preserveStartEnd"
                allowDataOverflow
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                tickMargin={14}
                height={40}
                minTickGap={18}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                width={52}
                tickMargin={10}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                domain={price ? ["auto", "auto"] : [0, "auto"]}
              />
              {price && (
                <ReferenceLine
                  y={0}
                  stroke="var(--muted)"
                  ifOverflow="extendDomain"
                />
              )}
              <ReferenceLine
                x={time}
                stroke="var(--focus)"
                strokeDasharray="3 3"
              />
              {axis.dayStarts
                .filter((t) => t > domain[0] && t < domain[1])
                .map((t) => (
                  <ReferenceLine key={t} x={t} stroke="var(--border)" />
                ))}
              {series.map((s, i) => (
                <Line
                  key={s.id}
                  type={price ? "stepAfter" : "linear"}
                  dataKey={s.id}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                  stroke={i === 1 ? "var(--solar)" : "var(--ink)"}
                  strokeWidth={2}
                  strokeDasharray={
                    s.classification === "forecast" ? "6 4" : undefined
                  }
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="market-chart-empty">
          {price
            ? series[0]?.quality.issues.includes("price-permission-required")
              ? "Prices unavailable — publication permission has not been confirmed."
              : "No prices published for this delivery window."
            : "No usable intervals. Other sections remain available."}
        </div>
      )}
    </section>
  );
}

function Current({ data, time }: { data: Dashboard; time: number }) {
  const reading = (id: string) => {
    const s = data.series.find((s) => s.id === id);
    if (id === "day-ahead-price") return intervalAt(s?.intervals ?? [], time);
    return s?.intervals
      .filter(
        (p) =>
          p.value != null &&
          Date.parse(p.start) <= time &&
          time - Date.parse(p.start) <= 900_000,
      )
      .at(-1);
  };
  return (
    <dl className="market-current">
      {["consumption-now", "production-now", "day-ahead-price"].map((id) => {
        const s = data.series.find((s) => s.id === id),
          p = reading(id);
        return (
          <div key={id}>
            <dt>
              {id === "day-ahead-price" ? "Current delivery price" : s?.label}
            </dt>
            <dd>
              {number(p?.value, id === "day-ahead-price" ? 2 : 0)}
              {p?.value != null && <span> {s?.unit}</span>}
            </dd>
            <dd className="market-current-time">
              {p ? deliveryLabel(p.start) : "No current reading"}
              {s?.quality.freshness === "stale" && " · stale"}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function WeatherContext({
  forecast,
  time,
  domain,
  inspect,
  axis,
}: {
  forecast?: Forecast;
  time: number;
  domain: [number, number];
  inspect: (time: number) => void;
  axis: ReturnType<typeof deliveryAxis>;
}) {
  const { instant, irradiance } = weatherAt(forecast?.hourly ?? [], time);
  return (
    <section className="market-weather">
      <h3>Weather at selected point</h3>
      <p>Context, not a Finland-wide weather estimate.</p>
      <dl>
        <div>
          <dt>Temperature</dt>
          <dd>
            {number(instant?.temperatureC, 1)}
            {instant?.temperatureC != null && " °C"}
          </dd>
        </div>
        <div>
          <dt>Wind at 10 m</dt>
          <dd>
            {number(instant?.windSpeedMs, 1)}
            {instant?.windSpeedMs != null && " m/s"}
          </dd>
        </div>
        <div>
          <dt>Irradiance</dt>
          <dd>
            {number(irradiance?.solarIrradianceWm2)}
            {irradiance?.solarIrradianceWm2 != null && " W/m²"}
          </dd>
        </div>
      </dl>
      <div className="market-point-charts">
        {[
          { key: "temperatureC", label: "Temperature", unit: "°C" },
          { key: "windSpeedMs", label: "Wind at 10 m", unit: "m/s" },
          {
            key: "solarIrradianceWm2",
            label: "Irradiance · preceding-hour mean",
            unit: "W/m²",
          },
        ].map((metric) => {
          const solar = metric.key === "solarIrradianceWm2";
          const rows = (forecast?.hourly ?? [])
            .map((h) => ({
              time: h.time - (solar ? 1_800_000 : 0),
              value:
                h[
                  metric.key as
                    "temperatureC" | "windSpeedMs" | "solarIrradianceWm2"
                ],
            }))
            .filter((h) => h.time >= domain[0] && h.time <= domain[1]);
          const Plot = solar ? BarChart : LineChart;
          return (
            <div className="market-native-chart" key={metric.key}>
              <p>
                {metric.label} · {metric.unit}
              </p>
              <div className="market-chart-canvas" aria-hidden="true">
                <ResponsiveContainer width="100%" height="100%">
                  <Plot
                    data={rows}
                    accessibilityLayer={false}
                    margin={{ left: 0, right: 18 }}
                    onMouseMove={(state) => {
                      if (typeof state.activeLabel === "number")
                        inspect(state.activeLabel);
                    }}
                  >
                    <Tooltip content={() => null} cursor={false} />
                    <CartesianGrid vertical={false} stroke="var(--grid)" />
                    <XAxis
                      dataKey="time"
                      type="number"
                      domain={domain}
                      ticks={axis.ticks}
                      tickFormatter={axis.label}
                      interval="preserveStartEnd"
                      allowDataOverflow
                      tick={{ fill: "var(--muted)", fontSize: 11 }}
                      tickMargin={14}
                      height={40}
                      minTickGap={18}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      width={52}
                      tickMargin={10}
                      tick={{ fill: "var(--muted)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <ReferenceLine
                      x={time}
                      stroke="var(--focus)"
                      strokeDasharray="3 3"
                    />
                    {axis.dayStarts
                      .filter((t) => t > domain[0] && t < domain[1])
                      .map((t) => (
                        <ReferenceLine key={t} x={t} stroke="var(--border)" />
                      ))}
                    {solar ? (
                      <Bar
                        dataKey="value"
                        fill="var(--solar-fill)"
                        isAnimationActive={false}
                      />
                    ) : (
                      <Line
                        dataKey="value"
                        stroke="var(--ink)"
                        dot={{ r: 2 }}
                        isAnimationActive={false}
                        connectNulls={false}
                      />
                    )}
                  </Plot>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })}
      </div>
      <p className="helper">
        {instant
          ? `Temperature and wind sampled ${deliveryLabel(instant.time)}.`
          : "No hourly sample for this period."}{" "}
        {irradiance
          ? `Irradiance mean: ${deliveryLabel(irradiance.time - 3_600_000)} to ${deliveryLabel(irradiance.time)}.`
          : "No enclosing irradiance hour."}{" "}
        Point wind and irradiance are not national generation.
      </p>
    </section>
  );
}

export default function MarketDesk({
  place,
  forecast,
  settings,
  onSettings,
}: {
  place: Place;
  forecast?: Forecast;
  settings: MarketSettings;
  onSettings: (settings: MarketSettings) => void;
}) {
  const query = useMarkets(place, settings);
  const daysId = useId();
  const daysPopover = useRef<HTMLDivElement>(null);
  const daysTrigger = useRef<HTMLButtonElement>(null);
  const daysAnchor = {
    "--anchor": `--market-days-${daysId.replace(/[^a-zA-Z0-9]/g, "")}`,
  } as CSSProperties;
  const [selected, setSelected] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const data = useMemo(
    () => (query.data ? visibleDashboard(query.data, now) : undefined),
    [query.data, now],
  );
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const today = helsinkiDate();
  const grid =
    data?.series.find((s) => s.id === "consumption-forecast")?.intervals ?? [];
  const selectedIndex = Math.max(
    0,
    grid.findIndex(
      (p) =>
        selected !== null &&
        Date.parse(p.start) <= selected &&
        selected < Date.parse(p.end),
    ),
  );
  const interval = grid[selectedIndex],
    time = interval ? Date.parse(interval.start) : 0;
  const domain: [number, number] = data
    ? [
        Date.parse(data.requestedInterval.start),
        Date.parse(data.requestedInterval.end),
      ]
    : [0, 1];
  const axis = deliveryAxis(domain);
  function download() {
    if (!data) return;
    const url = URL.createObjectURL(
      new Blob([marketCsv(data)], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `saavirta-fi-${settings.date}${data.marketContext.demonstration ? "-demo" : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section
      className="market-desk"
      aria-label="Finland electricity Delivery desk"
    >
      <div className="market-title">
        <div>
          <h2>Finland electricity</h2>
          <p>National fundamentals · FI bidding zone · Europe/Helsinki</p>
        </div>
        <span className="market-desk-label">Delivery desk</span>
      </div>
      {data?.marketContext.region === "aland" && (
        <p className="status-message" role="note">
          Finland national comparison. Åland belongs to SE3; these are not your
          local market prices.
        </p>
      )}
      <div className="market-controls">
        <div className="market-dates">
          <label>
            Delivery date
            <input
              type="date"
              value={settings.date}
              min={shiftDate(today, -7)}
              max={shiftDate(today, 2)}
              onChange={(e) => {
                if (e.target.value)
                  onSettings({ ...settings, date: e.target.value, days: 1 });
              }}
            />
          </label>
          <div className="market-day-picker">
            <span id={`${daysId}-label`}>Days</span>
            <button
              ref={daysTrigger}
              type="button"
              className="button market-days-trigger"
              popoverTarget={daysId}
              style={daysAnchor}
              aria-labelledby={`${daysId}-label ${daysId}-value`}
            >
              <span id={`${daysId}-value`}>
                {settings.days} {settings.days === 1 ? "day" : "days"}
              </span>
              <CaretDownIcon aria-hidden="true" />
            </button>
            <div
              ref={daysPopover}
              id={daysId}
              popover="auto"
              role="group"
              aria-label="Delivery days"
              className="info-popover market-days-popover"
              style={daysAnchor}
            >
              {[1, 2, 3]
                .filter(
                  (n) => shiftDate(settings.date, n - 1) <= shiftDate(today, 2),
                )
                .map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="market-day-option"
                    aria-pressed={settings.days === n}
                    onClick={() => {
                      onSettings({ ...settings, days: n });
                      daysPopover.current?.hidePopover();
                      daysTrigger.current?.focus();
                    }}
                  >
                    {n} {n === 1 ? "day" : "days"}
                    {settings.days === n && <CheckIcon aria-hidden="true" />}
                  </button>
                ))}
            </div>
          </div>
        </div>
        <div
          className="segmented"
          role="group"
          aria-label="Delivery resolution"
        >
          {(["PT15M", "PT60M"] as const).map((resolution) => (
            <button
              key={resolution}
              aria-pressed={settings.resolution === resolution}
              onClick={() => onSettings({ ...settings, resolution })}
            >
              {resolution === "PT15M" ? "15 min" : "1 hour"}
            </button>
          ))}
        </div>
        <div className="market-actions">
          <button
            className="icon-button"
            aria-label="Refresh markets"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            <ArrowClockwiseIcon />
          </button>
          <button className="button" disabled={!data} onClick={download}>
            <DownloadSimpleIcon />
            Export CSV
          </button>
          <a className="button" href="#market-sources">
            Data status
          </a>
        </div>
      </div>
      {query.isError && (
        <p className="status-message" role="alert">
          {query.error.message}{" "}
          {data &&
            "Showing the last retrieved dashboard; check collection times below."}
        </p>
      )}
      {!data ? (
        <div className="market-empty" role="status">
          <h3>
            {query.isPending
              ? "Collecting the delivery picture…"
              : "The delivery picture is unavailable"}
          </h3>
          <p>
            Demand, generation and price sections load independently. No missing
            value is treated as zero.
          </p>
          <button
            className="button"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            Retry markets
          </button>
        </div>
      ) : (
        <>
          <Current
            data={data}
            time={
              data.marketContext.demonstration
                ? Date.parse(data.generatedAt)
                : now
            }
          />
          {settings.resolution === "PT60M" && (
            <p className="helper">
              Hourly values are duration-weighted summaries. Price extrema below
              retain native delivery periods.
            </p>
          )}
          <div className="delivery-layout">
            <aside
              className="period-inspector"
              aria-label="Delivery period inspector"
            >
              <p className="eyebrow">Delivery period</p>
              <h3>{interval ? deliveryLabel(interval.start) : "No period"}</h3>
              <p>{interval && `Until ${deliveryLabel(interval.end)}`}</p>
              <label className="market-scrubber">
                Inspect a delivery period
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, grid.length - 1)}
                  value={selectedIndex}
                  aria-label="Delivery period"
                  aria-valuetext={
                    interval ? deliveryLabel(interval.start) : "No interval"
                  }
                  onChange={(e) =>
                    setSelected(Date.parse(grid[Number(e.target.value)].start))
                  }
                />
              </label>
              <dl className="market-readings">
                {data.series
                  .filter((s) => !s.id.endsWith("-now"))
                  .map((s) => {
                    const p = intervalAt(s.intervals, time);
                    return (
                      <div key={s.id}>
                        <dt>{s.label}</dt>
                        <dd>
                          {number(p?.value, s.unit === "EUR/MWh" ? 2 : 0)}
                          {p?.value != null && <small> {s.unit}</small>}
                        </dd>
                        {p?.provisional && (
                          <dd className="helper">Provisional</dd>
                        )}
                        {p?.missingReason && (
                          <dd className="helper">
                            {p.missingReason.replaceAll("-", " ")}
                          </dd>
                        )}
                        {p?.inputs.map((input) => (
                          <dd className="helper" key={input.snapshotId}>
                            Collected {deliveryLabel(input.collectedAt)}
                          </dd>
                        ))}
                      </div>
                    );
                  })}
              </dl>
            </aside>
            <div className="market-charts">
              {groups.map((g) => (
                <ChartRow
                  key={g.title}
                  title={g.title}
                  unit={g.unit}
                  series={data.series.filter((s) => g.ids.includes(s.id))}
                  domain={domain}
                  axis={axis}
                  time={time}
                  inspect={setSelected}
                  price={g.unit === "EUR/MWh"}
                />
              ))}
              <WeatherContext
                forecast={forecast}
                time={time}
                domain={domain}
                axis={axis}
                inspect={setSelected}
              />
            </div>
          </div>
          <section className="market-analysis">
            <h3>Forecast changes & observed error</h3>
            <p>
              For the inspected delivery period. Every comparison uses collected
              snapshots.
            </p>
            <div className="market-metrics">
              {data.metrics.map((metric) => (
                <MetricCard
                  key={metric.id}
                  metric={metric}
                  point={intervalAt(metric.intervals, time)}
                  series={data.series}
                  demonstration={data.marketContext.demonstration}
                />
              ))}
            </div>
          </section>
          <section className="market-analysis">
            <h3>Published price periods</h3>
            <div className="price-summaries">
              {data.priceSummaries.map((s) => (
                <article key={s.date}>
                  <h4>{s.date}</h4>
                  <p>
                    {s.label}:{" "}
                    <strong>
                      {number(s.average, 2)}
                      {s.average != null && " EUR/MWh"}
                    </strong>
                  </p>
                  <p>
                    {Math.round(s.coverage * 100)}% coverage ·{" "}
                    {number(s.negativeMinutes)} negative-price minutes
                  </p>
                  <div>
                    {(["minimum", "maximum"] as const).map(
                      (key) =>
                        s[key] && (
                          <button
                            className="button"
                            key={key}
                            onClick={() => {
                              setSelected(Date.parse(s[key]!.start));
                              document
                                .querySelector(".period-inspector")
                                ?.scrollIntoView({
                                  block: "center",
                                  behavior: "instant",
                                });
                            }}
                          >
                            {key === "minimum" ? "Lowest" : "Highest"}:{" "}
                            {number(s[key]!.value, 2)} EUR/MWh ·{" "}
                            {deliveryLabel(s[key]!.start)}
                          </button>
                        ),
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
          <details className="market-table">
            <summary>Accessible delivery interval table</summary>
            <div className="market-table-scroll">
              <table>
                <caption>
                  Finland market values · missing values remain unavailable
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Delivery (Helsinki)</th>
                    {data.series
                      .filter((s) => !s.id.endsWith("-now"))
                      .map((s) => (
                        <th scope="col" key={s.id}>
                          {s.label} ({s.unit})
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {grid.map((p) => (
                    <tr key={p.start}>
                      <th scope="row">
                        <button
                          className="text-button"
                          onClick={() => setSelected(Date.parse(p.start))}
                        >
                          {deliveryLabel(p.start)}
                        </button>
                      </th>
                      {data.series
                        .filter((s) => !s.id.endsWith("-now"))
                        .map((s) => {
                          const value = intervalAt(
                            s.intervals,
                            Date.parse(p.start),
                          );
                          return (
                            <td key={s.id}>
                              {number(value?.value, 2)}
                              {value?.provisional ? " (provisional)" : ""}
                            </td>
                          );
                        })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <details className="market-sources" id="market-sources">
            <summary>Sources, freshness & methodology</summary>
            <p>
              Fingrid Open Data (CC BY 4.0): national power and forecasts. MWh/h
              is equivalent to MW, not quarter-hour energy. ENTSO-E: published
              FI day-ahead prices; display and export require separate
              permission.{" "}
              {data.marketContext.demonstration &&
                "This dashboard contains synthetic demonstration values, not provider observations."}
            </p>
            <p>
              Freshness records successful checks. Availability records usable
              delivery coverage. A series can be partial and stale. Collection
              time is an observed vintage, not an official forecast issue time.
              Current telemetry is not settled quarter-hour energy. Wind
              forecasts incorporate day-ahead price effects; these charts do not
              establish causation.
            </p>
            <p>
              UTC half-open delivery intervals, shown in Helsinki time with
              offsets. Local days can have 92, 96 or 100 quarter-hours. Missing
              coverage withholds averages; prices remain signed.{" "}
              {data.priceExportAllowed
                ? "Price export is enabled."
                : "Price export is disabled; CSV contains fundamentals and derived metrics only."}
            </p>
            <ul>
              {data.series.map((s) => (
                <li key={s.id}>
                  <strong>{s.label}</strong> · {s.provider} {s.dataset} ·{" "}
                  {s.quality.freshness} / {s.quality.availability} ·{" "}
                  {Math.round(s.quality.coverage * 100)}% coverage
                  <br />
                  Last successful check:{" "}
                  {s.provenance.lastSuccessfulCheck
                    ? deliveryLabel(s.provenance.lastSuccessfulCheck)
                    : "Never"}
                  . Provider publication:{" "}
                  {s.provenance.publishedAt
                    ? deliveryLabel(s.provenance.publishedAt)
                    : "Unknown"}
                  . {s.quality.issues.join(", ")}
                </li>
              ))}
            </ul>
            <p>
              Boundary: {data.marketContext.boundaryVersion}. National Land
              Survey administrative areas include water; a 25-metre uncertainty
              band is application policy.{" "}
              {!data.marketContext.demonstration && (
                <>
                  Contains National Land Survey of Finland Division into
                  administrative areas data, delivered 15 October 2026, under{" "}
                  <a href="https://www.maanmittauslaitos.fi/en/opendata-licence-cc40">
                    CC BY 4.0
                  </a>
                  .{" "}
                </>
              )}
              <a href="https://data.fingrid.fi/en/datasets">Fingrid datasets</a>{" "}
              ·{" "}
              <a href="https://transparency.entsoe.eu/">
                ENTSO-E Transparency Platform
              </a>{" "}
              ·{" "}
              <a href="https://www.maanmittauslaitos.fi/en/maps-and-spatial-data/datasets-and-interfaces/product-descriptions/division-administrative-areas-vector">
                Boundary source
              </a>
            </p>
          </details>
        </>
      )}
    </section>
  );
}
