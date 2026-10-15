export const HOUR = 3_600_000;
export const formatNumber = (value: number | null, digits = 1) =>
  value == null
    ? "Unavailable"
    : new Intl.NumberFormat("en-GB", {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      }).format(value);
export const localTime = (
  time: number,
  timezone: string,
  options: Intl.DateTimeFormatOptions = {},
) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  }).format(time);
export const localDate = (time: number, timezone: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(time);
export const offset = (time: number, timezone: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    timeZoneName: "shortOffset",
  })
    .formatToParts(time)
    .find((p) => p.type === "timeZoneName")?.value ?? "UTC";
// One formatter per call site; formatToParts keeps the local calendar day and hour exact across DST.
export const localClock = (timezone: string) => {
  const format = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  });
  return (time: number) => {
    const part: Record<string, string> = {};
    for (const { type, value } of format.formatToParts(time))
      part[type] = value;
    return {
      day: `${part.year}-${part.month}-${part.day}`,
      hour: Number(part.hour),
    };
  };
};
export const hourLabel = (time: number, zone: string) =>
  `${localDate(time, zone)}, ${localTime(time, zone)} ${offset(time, zone)}`;
export const solarInterval = (time: number, zone: string) =>
  `${localTime(time - HOUR, zone)} ${offset(time - HOUR, zone)} - ${localTime(time, zone)} ${offset(time, zone)}`;
export const coordinates = (lat: number, lon: number) =>
  `${formatNumber(Math.abs(lat), 3)}° ${lat < 0 ? "S" : "N"}, ${formatNumber(Math.abs(lon), 3)}° ${lon < 0 ? "W" : "E"}`;
