"use client";
import {
  useId,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  CheckIcon,
  CopyIcon,
  SlidersHorizontalIcon,
} from "@phosphor-icons/react";
import type { Baselines, Forecast } from "@/features/weather/types";
import {
  type ForecastRange,
  type Uncertainty,
} from "@/features/weather/uncertainty";
import {
  compareDays,
  COOLING_BASE_C,
  dailySummary,
  HEATING_BASE_C,
  relativeDays,
  type DayComparison,
} from "@/features/weather/overview";
import {
  formatNumber,
  HOUR,
  hourLabel,
  localDate,
  localTime,
} from "@/lib/time";
import { InfoTip } from "./info-tip";
import { TextShimmer } from "./motion/text-shimmer";
import { TransitionPanel } from "./motion/transition-panel";
import { AnimatedBackground } from "./motion/animated-background";
import { MetricSky } from "./metric-sky";
import {
  CONDITION_METRICS,
  DailyConditions,
  type ConditionMetric,
} from "./daily-conditions";

const missing = (
  <>
    <span aria-hidden="true">n/a</span>
    <span className="sr-only">Unavailable</span>
  </>
);
const loading = (
  <>
    <span aria-hidden="true">…</span>
    <span className="sr-only">Loading</span>
  </>
);
export const show = (value: number | null, digits = 1): ReactNode =>
  value === null ? missing : formatNumber(value, digits);
export const rangeText = (
  range: ForecastRange | null | undefined,
  digits = 1,
) =>
  range
    ? `${formatNumber(range.p10, digits)}–${formatNumber(range.p90, digits)}`
    : "n/a";
// Signed comparisons use a true minus sign so columns of + and − align.
const signed = (value: number, digits: number, suffix = "") => {
  const rounded = Number(value.toFixed(digits));
  return `${rounded > 0 ? "+" : rounded < 0 ? "−" : ""}${formatNumber(Math.abs(rounded), digits)}${suffix}`;
};
// Product heuristics that draw the eye to large differences; not trading thresholds.
export const NOTABLE = {
  anomalyC: 2,
  revisionC: 1,
  solarPct: 25,
  revisionKwhM2: 0.5,
};
const utcRun = (time: number) =>
  `${localTime(time, "UTC")} UTC ${localDate(time, "UTC")}`;

export type BaselineState = {
  data: Baselines | undefined;
  status: "pending" | "error" | "success";
  retry: () => void;
};

export function DailySummary({
  forecast,
  ensemble,
  baselines,
  focusDay,
  onFocusDay,
  controls,
  updating,
  dark,
  selectedTime,
  onInspect,
}: {
  forecast: Forecast;
  ensemble: {
    enabled: boolean;
    data: Uncertainty | undefined;
    isFetching: boolean;
    isError: boolean;
    stale: boolean;
    toggle: () => void;
    retry: () => void;
  };
  baselines: BaselineState;
  focusDay: string | null;
  onFocusDay: (day: string | null) => void;
  /** The horizon control, kept beside the heading of the content it scopes. */
  controls: ReactNode;
  /** Status text while another horizon loads over this one. */
  updating?: string;
  dark: boolean;
  selectedTime: number | null;
  onInspect: (time: number) => void;
}) {
  const id = useId();
  const [copied, setCopied] = useState(false);
  const [visibleMetrics, setVisibleMetrics] = useState<ConditionMetric[]>(() =>
    CONDITION_METRICS.map(({ key }) => key),
  );
  const filterAnchor = {
    "--anchor": `--metrics-${id.replace(/[^a-zA-Z0-9]/g, "")}`,
  } as CSSProperties;
  const {
    hourly,
    location: { timezone },
  } = forecast;
  const days = useMemo(
    () => dailySummary(hourly, timezone),
    [hourly, timezone],
  );
  const ranges = new Map(ensemble.data?.daily.map((day) => [day.key, day]));
  const rangeNote = (range: ForecastRange | null | undefined, digits = 1) =>
    ensemble.data && (
      <small className="daily-range">
        <span className="sr-only">P10–P90 </span>
        {rangeText(range, digits)}
      </small>
    );
  const comparisons = useMemo(
    () => compareDays(hourly, timezone, baselines.data),
    [hourly, timezone, baselines.data],
  );
  const relative = relativeDays(
    days.map((d) => d.key),
    hourly[0].time,
    timezone,
  );
  const time = (t: number) => localTime(t, timezone);
  const labels = days.map((day, i) => {
    const cut = [
      day.startsLate && `from ${time(day.start)}`,
      day.endsEarly && `until ${time(day.end)}`,
    ]
      .filter(Boolean)
      .join(" ");
    const date = localDate(day.start, timezone);
    return {
      name: relative[i] ?? date,
      note: relative[i] ? [date, cut].filter(Boolean).join(", ") : cut,
      partial: !!cut,
    };
  });
  const conditionDayIndex = Math.max(
    0,
    days.findIndex((day) => day.key === focusDay),
  );
  const conditionDay = days[conditionDayIndex];
  const temperatures = days.flatMap((d) =>
    d.low === null || d.high === null ? [] : [d.low, d.high],
  );
  const floor = Math.min(...temperatures),
    span = Math.max(...temperatures) - floor || 1;
  const maxEnergy = Math.max(0, ...days.map((d) => d.solarEnergyKwhM2 ?? 0));
  const comparison = (
    key: string,
    field: keyof DayComparison,
    digits: number,
    suffix: string,
    notable: number,
  ) => {
    if (baselines.status === "pending") return loading;
    const value = comparisons.get(key)?.[field] ?? null;
    if (value === null) return missing;
    return (
      <span data-notable={Math.abs(value) >= notable || undefined}>
        {signed(value, digits, suffix)}
      </span>
    );
  };
  const dayHeader = (key: string, i: number) => (
    <th scope="row">
      <button
        type="button"
        className="day-button"
        aria-pressed={focusDay === key}
        aria-describedby={`${id}-focus`}
        onClick={() => onFocusDay(focusDay === key ? null : key)}
      >
        <strong>{labels[i].name}</strong>
        {labels[i].note && <small>{labels[i].note}</small>}
      </button>
    </th>
  );
  const copy = async () => {
    const value = (v: number | null | undefined) =>
      v === null || v === undefined ? "" : String(Number(v.toFixed(2)));
    const rows = days.map((day, i) => {
      const c = comparisons.get(day.key);
      const range = ranges.get(day.key);
      return [
        labels[i].partial
          ? `${labels[i].name} (${labels[i].note})`
          : labels[i].name,
        day.key,
        value(day.low),
        value(day.high),
        value(c?.anomalyC),
        value(c?.revisionC),
        value(day.heatingDegreeDays),
        value(day.coolingDegreeDays),
        value(day.solarEnergyKwhM2),
        value(c?.solarAnomalyPct),
        value(c?.revisionKwhM2),
        value(day.solarPeakWm2),
        day.solarPeakTime === null
          ? ""
          : `${time(day.solarPeakTime - HOUR)}-${time(day.solarPeakTime)}`,
        value(day.cloudMeanPct),
        ...(ensemble.data
          ? [
              ...[
                range?.heatingDegreeDays,
                range?.coolingDegreeDays,
                range?.solarEnergyKwhM2,
              ].flatMap((r) => [value(r?.p10), value(r?.p50), value(r?.p90)]),
              ensemble.data.model,
              new Date(ensemble.data.source.retrievedAt).toISOString(),
              "Uncalibrated ensemble spread",
            ]
          : []),
      ].join("\t");
    });
    try {
      await navigator.clipboard.writeText(
        [
          [
            "Day",
            "Date",
            "Low °C",
            "High °C",
            "vs normal °C",
            "Revision °C",
            "HDD",
            "CDD",
            "Solar kWh/m²",
            "Solar vs normal %",
            "Solar revision kWh/m²",
            "Peak W/m²",
            "Peak hour",
            "Cloud %",
            ...(ensemble.data
              ? [
                  ...["ECMWF HDD", "ECMWF CDD", "ECMWF Solar kWh/m²"].flatMap(
                    (name) => ["P10", "P50", "P90"].map((p) => `${name} ${p}`),
                  ),
                  "Ensemble model",
                  "Ensemble retrieved UTC",
                  "Range interpretation",
                ]
              : []),
          ].join("\t"),
          ...rows,
        ].join("\n"),
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  const normals = baselines.data?.normals,
    revision = baselines.data?.revision;
  return (
    <section className="daily" aria-labelledby={id} aria-busy={!!updating}>
      <div className="section-heading summary-heading">
        <h2 id={id}>Daily summary</h2>
        {controls}
        <span className="summary-status" role="status">
          {updating && <TextShimmer>{updating}</TextShimmer>}
        </span>
        <div className="summary-actions" style={filterAnchor}>
          <button
            type="button"
            className="button range-toggle"
            aria-pressed={ensemble.enabled}
            onClick={ensemble.toggle}
          >
            Forecast range
          </button>
          <button
            type="button"
            className="button metric-filter-button"
            popoverTarget={`${id}-metrics`}
            aria-label="Show metrics"
          >
            <SlidersHorizontalIcon aria-hidden="true" />
            <span className="metric-filter-label">Show metrics</span>
            <span className="metric-count" aria-hidden="true">
              {visibleMetrics.length + 2}/6
            </span>
          </button>
          <div
            id={`${id}-metrics`}
            popover="auto"
            className="info-popover metric-filter"
          >
            <fieldset>
              <legend>Show metrics</legend>
              {["Temperature", "Solar"].map((name) => (
                <label key={name}>
                  <input
                    type="checkbox"
                    checked
                    disabled
                    aria-label={name}
                    aria-describedby={`${id}-required`}
                  />
                  <span>{name}</span>
                  <small aria-hidden="true">Always shown</small>
                </label>
              ))}
              <p id={`${id}-required`} className="sr-only">
                Always shown in the daily summary.
              </p>
              <div className="metric-options">
                {CONDITION_METRICS.map(({ key, name }) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={visibleMetrics.includes(key)}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setVisibleMetrics((current) =>
                          checked
                            ? [...current, key]
                            : current.filter((metric) => metric !== key),
                        );
                      }}
                    />
                    <span>{name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <button
              type="button"
              className="button metric-filter-done"
              popoverTarget={`${id}-metrics`}
              popoverTargetAction="hide"
            >
              Done
            </button>
          </div>
          <button type="button" className="text-button" onClick={copy}>
            <TransitionPanel inline activeKey={copied ? "copied" : "copy"}>
              {copied ? <CheckIcon /> : <CopyIcon />}
            </TransitionPanel>
            {copied ? "Copied" : "Copy table"}
          </button>
        </div>
        <span className="sr-only" role="status">
          {copied ? "Daily summary copied as tab-separated values" : ""}
        </span>
      </div>
      <p id={`${id}-focus`} hidden>
        Shows this day in the weather tiles and hourly forecast
      </p>
      {ensemble.enabled && (
        <div className="ensemble-note">
          <p role="status">
            {ensemble.data ? (
              <>
                ECMWF P10–P90 below daily totals · 51 members. Model spread, not
                a calibrated probability.
                {(ensemble.isError ||
                  ensemble.data.source.refreshFailed ||
                  ensemble.stale) &&
                  " Using an older retrieval."}
              </>
            ) : ensemble.isFetching ? (
              "Loading forecast ranges…"
            ) : (
              "Forecast ranges are unavailable. The point forecast is still shown."
            )}
          </p>
          <InfoTip label="About forecast ranges">
            <p>
              The range spans the 10th to 90th percentiles of 51 ECMWF ensemble
              members; P50 is their median. It has not been checked for 80%
              coverage of real outcomes.
            </p>
            <p>
              HDD, CDD and solar totals are calculated separately for every
              member before taking percentiles, over the same forecast hours
              shown here. A missing member or hour leaves a gap.
            </p>
            <p>
              This model is separate from the point forecast. Its native
              three-hour steps are interpolated to hourly output by Open-Meteo.
              A revision inside this range is not, by itself, evidence of noise.
            </p>
            {ensemble.data && (
              <p>
                Retrieved{" "}
                {hourLabel(ensemble.data.source.retrievedAt, timezone)}. The
                provider does not identify the model run in this response.
              </p>
            )}
          </InfoTip>
          {!ensemble.data && !ensemble.isFetching && (
            <button
              type="button"
              className="text-button"
              onClick={ensemble.retry}
            >
              Retry ranges
            </button>
          )}
        </div>
      )}
      <div className="daily-boxes">
        <section className="daily-box" aria-labelledby={`${id}-t`}>
          <MetricSky
            metric="temperature"
            dark={dark}
            cold={(conditionDay?.high ?? 1) <= 0}
          />
          <div className="daily-box-head">
            <h3 id={`${id}-t`}>
              <span className="series-mark" aria-hidden="true" />
              Temperature
            </h3>
            <InfoTip label="About the temperature columns">
              <dl>
                <dt>Low to high</dt>
                <dd>
                  Lowest and highest hourly temperature, on one scale for every
                  day.
                </dd>
                <dt>vs normal</dt>
                <dd>
                  Forecast mean minus the past-decade mean for the same local
                  hours.
                </dd>
                <dt>Revision</dt>
                <dd>
                  Change in ECMWF&apos;s forecast mean since its run 24 hours
                  earlier. Plus is warmer.
                </dd>
                <dt>HDD, CDD</dt>
                <dd>
                  Hourly heating and cooling degree days, bases {HEATING_BASE_C}{" "}
                  °C and {COOLING_BASE_C} °C.
                </dd>
              </dl>
            </InfoTip>
          </div>
          <div
            className="daily-scroll"
            role="region"
            aria-label="Temperature summary table"
            tabIndex={0}
          >
            <table className="daily-table" aria-labelledby={`${id}-t`}>
              <thead>
                <tr>
                  <th scope="col">Day</th>
                  <th scope="col" className="range-col">
                    Low to high <small>°C</small>
                  </th>
                  <th scope="col">
                    vs normal <small>°C</small>
                  </th>
                  <th scope="col">
                    Revision <small>°C</small>
                  </th>
                  <th scope="col">
                    <abbr
                      title={`Heating degree days, base ${HEATING_BASE_C} °C`}
                    >
                      HDD
                    </abbr>{" "}
                    <small>°C·d</small>
                  </th>
                  <th scope="col">
                    <abbr
                      title={`Cooling degree days, base ${COOLING_BASE_C} °C`}
                    >
                      CDD
                    </abbr>{" "}
                    <small>°C·d</small>
                  </th>
                </tr>
              </thead>
              <tbody>
                {days.map((day, i) => (
                  <tr
                    key={day.key}
                    data-partial={labels[i].partial || undefined}
                    data-focused={focusDay === day.key || undefined}
                  >
                    {dayHeader(day.key, i)}
                    <td>
                      {day.low === null || day.high === null ? (
                        missing
                      ) : (
                        <span className="range">
                          <span>{formatNumber(day.low)}</span>
                          <span className="range-track" aria-hidden="true">
                            <span
                              className="range-bar"
                              style={{
                                left: `${((day.low - floor) / span) * 100}%`,
                                width: `${((day.high - day.low) / span) * 100}%`,
                              }}
                            />
                          </span>
                          <span>
                            <span className="sr-only">to </span>
                            {formatNumber(day.high)}
                          </span>
                        </span>
                      )}
                    </td>
                    <td>
                      {comparison(day.key, "anomalyC", 1, "", NOTABLE.anomalyC)}
                    </td>
                    <td>
                      {comparison(
                        day.key,
                        "revisionC",
                        1,
                        "",
                        NOTABLE.revisionC,
                      )}
                    </td>
                    <td>
                      {show(day.heatingDegreeDays)}
                      {rangeNote(ranges.get(day.key)?.heatingDegreeDays)}
                    </td>
                    <td>
                      {show(day.coolingDegreeDays)}
                      {rangeNote(ranges.get(day.key)?.coolingDegreeDays)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="daily-box" aria-labelledby={`${id}-s`}>
          <MetricSky metric="solar irradiance" dark={dark} />
          <div className="daily-box-head">
            <h3 id={`${id}-s`}>
              <span className="series-mark solar" aria-hidden="true" />
              Solar
            </h3>
            <InfoTip label="About the solar columns">
              <dl>
                <dt>Energy</dt>
                <dd>
                  Hourly mean irradiance summed over the day, kWh/m² on a
                  horizontal surface. Not PV output.
                </dd>
                <dt>vs normal</dt>
                <dd>
                  Percent above or below the past-decade mean for the same
                  hours.
                </dd>
                <dt>Revision</dt>
                <dd>
                  Change in ECMWF&apos;s solar energy since its run 24 hours
                  earlier.
                </dd>
                <dt>Peak, cloud</dt>
                <dd>Highest hourly mean with its hour; mean cloud cover.</dd>
              </dl>
            </InfoTip>
          </div>
          <div
            className="daily-scroll"
            role="region"
            aria-label="Solar summary table"
            tabIndex={0}
          >
            <table className="daily-table" aria-labelledby={`${id}-s`}>
              <thead>
                <tr>
                  <th scope="col">Day</th>
                  <th scope="col" className="energy-col">
                    Energy <small>kWh/m²</small>
                  </th>
                  <th scope="col">
                    vs normal <small>%</small>
                  </th>
                  <th scope="col">
                    Revision <small>kWh/m²</small>
                  </th>
                  <th scope="col">
                    Peak <small>W/m²</small>
                  </th>
                  <th scope="col">
                    Cloud <small>%</small>
                  </th>
                </tr>
              </thead>
              <tbody>
                {days.map((day, i) => (
                  <tr
                    key={day.key}
                    data-partial={labels[i].partial || undefined}
                    data-focused={focusDay === day.key || undefined}
                  >
                    {dayHeader(day.key, i)}
                    <td>
                      <span className="energy">
                        <span>{show(day.solarEnergyKwhM2, 2)}</span>
                        <span className="energy-track" aria-hidden="true">
                          <span
                            className="energy-bar"
                            style={{
                              width: `${maxEnergy ? ((day.solarEnergyKwhM2 ?? 0) / maxEnergy) * 100 : 0}%`,
                            }}
                          />
                        </span>
                      </span>
                      {rangeNote(ranges.get(day.key)?.solarEnergyKwhM2, 2)}
                    </td>
                    <td>
                      {comparison(
                        day.key,
                        "solarAnomalyPct",
                        0,
                        "%",
                        NOTABLE.solarPct,
                      )}
                    </td>
                    <td>
                      {comparison(
                        day.key,
                        "revisionKwhM2",
                        2,
                        "",
                        NOTABLE.revisionKwhM2,
                      )}
                    </td>
                    <td>
                      {show(day.solarPeakWm2, 0)}
                      {day.solarPeakTime !== null && (
                        <small>
                          <span className="sr-only"> from </span>
                          {time(day.solarPeakTime - HOUR)}-
                          {time(day.solarPeakTime)}
                        </small>
                      )}
                    </td>
                    <td>{show(day.cloudMeanPct, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <div className="daily-sources" role="status">
        {baselines.status === "pending" ? (
          <TextShimmer as="p">Loading normals and revisions…</TextShimmer>
        ) : baselines.status === "error" ? (
          <p>
            Normals and revisions are unavailable.{" "}
            <button
              type="button"
              className="text-button"
              onClick={baselines.retry}
            >
              Retry
            </button>
          </p>
        ) : (
          <p>
            {normals
              ? `Normal: ${normals.yearCount < normals.years[1] - normals.years[0] + 1 ? `${normals.yearCount} years of ` : ""}${normals.years[0]}-${normals.years[1]}, mean of the same local hour, ±${normals.smoothingDays} days (ERA5 reanalysis).`
              : "Normals are unavailable for this point."}{" "}
            {revision
              ? `Revision: ECMWF IFS run ${utcRun(revision.latestRun)} minus ${utcRun(revision.previousRun)}.`
              : "The run-to-run revision is unavailable."}
          </p>
        )}
      </div>
      {visibleMetrics.length > 0 && conditionDay && (
        <section
          className="daily-conditions"
          aria-labelledby={`${id}-conditions`}
          aria-describedby={`${id}-scope`}
        >
          <div className="conditions-heading">
            <h3 id={`${id}-conditions`}>Other conditions</h3>
            <div
              className="day-strip segmented"
              role="group"
              aria-label="Day for weather tiles"
            >
              <AnimatedBackground value={conditionDay.key}>
                {days.map((day, i) => (
                  <button
                    type="button"
                    key={day.key}
                    data-id={day.key}
                    aria-pressed={conditionDay.key === day.key}
                    onClick={() => onFocusDay(day.key)}
                  >
                    {labels[i].name}
                  </button>
                ))}
              </AnimatedBackground>
            </div>
          </div>
          <p className="conditions-scope" id={`${id}-scope`}>
            {labels[conditionDayIndex].note ||
              localDate(conditionDay.start, timezone)}{" "}
            · {timezone}. Forecast hours only.
          </p>
          <DailyConditions
            day={conditionDay}
            visible={visibleMetrics}
            dark={dark}
            hours={hourly}
            timezone={timezone}
            selectedTime={selectedTime}
            onInspect={onInspect}
          />
        </section>
      )}
      <details className="method">
        <summary>How daily values are calculated</summary>
        <div>
          <p>
            Days follow local midnight in {timezone}. Temperature, humidity,
            cloud and wind speed are hourly samples. Irradiance, wind gusts,
            precipitation and its probability describe the preceding hour and
            count toward the day that hour starts in.
          </p>
          <p>
            Weather tiles follow the selected day and only cover its forecast
            hours. Means, ranges and peaks use available samples; totals are
            unavailable if any value is missing. Precipitation includes rain,
            showers and the water equivalent of snow. The highest hourly chance
            is the peak probability of more than 0.1 mm in an hour, not a
            probability for the whole day.
          </p>
          <p>
            HDD and CDD sum each hour&apos;s difference below {HEATING_BASE_C}{" "}
            °C or above {COOLING_BASE_C} °C, divided by 24. The bases are
            illustrative, not a calibrated load model. Solar energy sums mean
            irradiance on a horizontal surface; PV output also needs capacity,
            orientation and losses.
          </p>
          <p>
            Comparisons use exactly the hours shown in each row, so partial days
            compare like with like. Normals come from reanalysis, which can
            differ systematically from forecast models at a point. Revisions
            compare two runs of one model, ECMWF IFS, whose runs reach six days
            ahead; later days show n/a. Bold marks a difference of at least{" "}
            {NOTABLE.anomalyC} °C from normal, a {NOTABLE.revisionC} °C
            revision, {NOTABLE.solarPct}% of normal sunshine or a{" "}
            {NOTABLE.revisionKwhM2} kWh/m² solar revision.
          </p>
        </div>
      </details>
    </section>
  );
}
