"use client";
import {
  CaretDownIcon,
  CloudIcon,
  CloudRainIcon,
  DropIcon,
  WindIcon,
  XIcon,
} from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { lazy, Suspense, useId, useRef, useState } from "react";
import type { DaySummary } from "@/features/weather/overview";
import type { Hour } from "@/features/weather/types";
import { formatNumber } from "@/lib/time";
import { MetricSky } from "./metric-sky";
import {
  Disclosure,
  DisclosureContent,
  DisclosureTrigger,
} from "./motion/disclosure";

const ConditionForecast = lazy(() =>
  import("./condition-forecast").then((module) => ({
    default: module.ConditionForecast,
  })),
);

export const CONDITION_METRICS = [
  { key: "humidity", name: "Humidity", Icon: DropIcon },
  { key: "wind", name: "Wind conditions", Icon: WindIcon },
  { key: "cloud", name: "Cloud cover", Icon: CloudIcon },
  { key: "precipitation", name: "Precipitation", Icon: CloudRainIcon },
] as const;
export type ConditionMetric = (typeof CONDITION_METRICS)[number]["key"];

const measurement = (value: number | null, unit: string, digits = 0) =>
  value === null ? "Unavailable" : `${formatNumber(value, digits)} ${unit}`;

export function DailyConditions({
  day,
  visible,
  dark,
  hours,
  timezone,
  selectedTime,
  onInspect,
}: {
  day: DaySummary;
  visible: ConditionMetric[];
  dark: boolean;
  hours: Hour[];
  timezone: string;
  selectedTime: number | null;
  onInspect: (time: number) => void;
}) {
  const reduce = useReducedMotion();
  const id = useId();
  const [activeMetric, setMetric] = useState<ConditionMetric>("wind");
  const [expanded, setExpanded] = useState(false);
  const opener = useRef<HTMLButtonElement | null>(null);
  const open = expanded && visible.includes(activeMetric);
  const title =
    activeMetric === "cloud"
      ? "Cloud cover and irradiance"
      : CONDITION_METRICS.find((item) => item.key === activeMetric)!.name;
  const values = {
    humidity: {
      value: day.humidityMeanPct,
      unit: "%",
      digits: 0,
      description: "Mean relative humidity",
      detail: "Hourly range",
      context:
        day.humidityLowPct === null || day.humidityHighPct === null
          ? "Unavailable"
          : `${formatNumber(day.humidityLowPct, 0)}–${formatNumber(day.humidityHighPct, 0)} %`,
      meter: day.humidityMeanPct,
    },
    wind: {
      value: day.windMeanMs,
      unit: "m/s",
      digits: 1,
      description: "Mean wind at 10 m",
      detail: "Peak gust",
      context: measurement(day.windGustMaxMs, "m/s", 1),
      meter: null,
    },
    cloud: {
      value: day.cloudMeanPct,
      unit: "%",
      digits: 0,
      description: "Mean sky coverage",
      detail: "Peak cloud cover",
      context: measurement(day.cloudMaxPct, "%"),
      meter: day.cloudMeanPct,
    },
    precipitation: {
      value: day.precipitationMm,
      unit: "mm",
      digits: 1,
      description: "Total in forecast hours",
      detail: "Highest hourly chance",
      context: measurement(day.precipitationProbabilityMaxPct, "%"),
      meter: null,
    },
  };
  return (
    <Disclosure
      id={id}
      open={open}
      onOpenChange={(next) => {
        setExpanded(next);
        if (!next) opener.current?.focus();
      }}
    >
      <div className="weather-tiles">
        <AnimatePresence initial={false} mode="popLayout">
          {CONDITION_METRICS.filter(({ key }) => visible.includes(key)).map(
            ({ key, name, Icon }) => {
              const metric = values[key];
              return (
                <motion.section
                  key={key}
                  className="weather-tile"
                  aria-label={name}
                  layout={reduce ? false : "position"}
                  initial={reduce ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduce ? 0 : 0.16 }}
                >
                  <MetricSky
                    metric={
                      key === "wind"
                        ? "wind conditions"
                        : key === "cloud"
                          ? "cloud cover"
                          : key
                    }
                    dark={dark}
                  />
                  <h4>
                    <Icon aria-hidden="true" />
                    {name}
                  </h4>
                  <p
                    className="weather-tile-value"
                    data-missing={metric.value === null || undefined}
                  >
                    {metric.value === null ? (
                      "Unavailable"
                    ) : (
                      <>
                        {formatNumber(metric.value, metric.digits)}
                        <span>{metric.unit}</span>
                      </>
                    )}
                  </p>
                  {metric.meter !== null && (
                    <div className="weather-meter" aria-hidden="true">
                      <span style={{ width: `${metric.meter}%` }} />
                    </div>
                  )}
                  <p className="weather-tile-description">
                    {metric.description}
                  </p>
                  <div className="weather-tile-detail">
                    <dl>
                      <dt>{metric.detail}</dt>
                      <dd>{metric.context}</dd>
                    </dl>
                  </div>
                  <button
                    type="button"
                    className="condition-toggle"
                    aria-label={`Hourly ${name.toLowerCase()}`}
                    aria-expanded={open && activeMetric === key}
                    aria-controls={id}
                    onClick={(event) => {
                      opener.current = event.currentTarget;
                      setMetric(key);
                      setExpanded(!(open && activeMetric === key));
                    }}
                  >
                    Hourly forecast <CaretDownIcon aria-hidden="true" />
                  </button>
                </motion.section>
              );
            },
          )}
        </AnimatePresence>
      </div>
      <DisclosureContent>
        <section className="condition-detail" aria-labelledby={`${id}-title`}>
          <div className="condition-detail-heading">
            <h4 id={`${id}-title`}>{title} · Hourly forecast</h4>
            <DisclosureTrigger>
              <button
                className="icon-button"
                aria-label="Close hourly forecast"
              >
                <XIcon aria-hidden="true" />
              </button>
            </DisclosureTrigger>
          </div>
          <Suspense fallback={<p role="status">Loading hourly detail…</p>}>
            <ConditionForecast
              metric={activeMetric}
              hours={hours}
              dayKey={day.key}
              timezone={timezone}
              selectedTime={selectedTime}
              onInspect={onInspect}
            />
          </Suspense>
        </section>
      </DisclosureContent>
    </Disclosure>
  );
}
