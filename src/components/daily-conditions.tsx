"use client";
import {
  CloudIcon,
  CloudRainIcon,
  DropIcon,
  WindIcon,
} from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { DaySummary } from "@/features/weather/overview";
import { formatNumber } from "@/lib/time";
import { MetricSky } from "./metric-sky";

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
}: {
  day: DaySummary;
  visible: ConditionMetric[];
  dark: boolean;
}) {
  const reduce = useReducedMotion();
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
                <p className="weather-tile-description">{metric.description}</p>
                <div className="weather-tile-detail">
                  <dl>
                    <dt>{metric.detail}</dt>
                    <dd>{metric.context}</dd>
                  </dl>
                </div>
              </motion.section>
            );
          },
        )}
      </AnimatePresence>
    </div>
  );
}
