"use client";
import {
  CloudIcon,
  CloudFogIcon,
  CloudLightningIcon,
  CloudRainIcon,
  CloudSnowIcon,
  CloudSunIcon,
  CloudMoonIcon,
  MoonIcon,
  SunIcon,
  QuestionIcon,
} from "@phosphor-icons/react";
import type { CurrentConditions } from "@/features/weather/types";
import { formatNumber, localTime } from "@/lib/time";

export function conditionFor(code: number | null, isDay: boolean) {
  if (code === 0 || code === 1)
    return {
      label: isDay ? "Clear skies" : "Clear night",
      Icon: isDay ? SunIcon : MoonIcon,
      kind: isDay ? "sun" : "moon",
    };
  if (code === 2)
    return {
      label: "Partly cloudy",
      Icon: isDay ? CloudSunIcon : CloudMoonIcon,
      kind: "cloud",
    };
  if (code === 3) return { label: "Overcast", Icon: CloudIcon, kind: "cloud" };
  if (code === 45 || code === 48)
    return { label: "Fog", Icon: CloudFogIcon, kind: "cloud" };
  if (
    code !== null &&
    [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)
  )
    return { label: "Rain", Icon: CloudRainIcon, kind: "rain" };
  if (code !== null && [71, 73, 75, 77, 85, 86].includes(code))
    return { label: "Snow", Icon: CloudSnowIcon, kind: "snow" };
  if (code !== null && [95, 96, 99].includes(code))
    return { label: "Thunderstorms", Icon: CloudLightningIcon, kind: "storm" };
  return {
    label: "Conditions unavailable",
    Icon: QuestionIcon,
    kind: "unknown",
  };
}
export function Conditions({
  current,
  timezone,
  old,
}: {
  current: CurrentConditions | null;
  timezone: string;
  old: boolean;
}) {
  const { Icon, kind, label } = conditionFor(
    current?.weatherCode ?? null,
    current?.isDay ?? true,
  );
  if (!current)
    return <p className="conditions">Current conditions not provided</p>;
  return (
    <p className="conditions" data-weather={kind}>
      <span className="conditions-label">Now</span>
      {current.temperatureC !== null && (
        <strong className="current-temperature">
          {formatNumber(current.temperatureC)} °C
        </strong>
      )}
      <span className={`weather-symbol ${kind}`} aria-hidden="true">
        <Icon size={20} weight="duotone" />
      </span>
      <span>{label}</span>
      <small>
        Modelled at {localTime(current.time, timezone)}
        {old && ", older retrieval"}
      </small>
    </p>
  );
}
