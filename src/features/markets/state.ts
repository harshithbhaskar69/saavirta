import type { MarketSettings } from "./contracts";

export function helsinkiDate(now = Date.now()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Helsinki",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function readMarketSettings(
  search: string,
  now = Date.now(),
): MarketSettings {
  const p = new URLSearchParams(search),
    date = p.get("delivery"),
    today = helsinkiDate(now);
  const valid =
    date &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(Date.parse(`${date}T12:00Z`)) &&
    new Date(`${date}T12:00Z`).toISOString().startsWith(date) &&
    date >= shiftDate(today, -7) &&
    date <= shiftDate(today, 2);
  const days = Math.min(3, Math.max(1, Number(p.get("marketDays")) || 1));
  return {
    date: valid ? date : today,
    days: Number.isInteger(days) ? days : 1,
    resolution: p.get("resolution") === "PT60M" ? "PT60M" : "PT15M",
  };
}
export function marketHref(
  href: string,
  workspace: "weather" | "markets",
  settings: MarketSettings,
) {
  const url = new URL(href, "https://local.invalid");
  if (workspace === "markets") url.searchParams.set("workspace", "markets");
  else url.searchParams.delete("workspace");
  url.searchParams.set("delivery", settings.date);
  url.searchParams.set("marketDays", String(settings.days));
  url.searchParams.set("resolution", settings.resolution);
  return `${url.pathname}${url.search}`;
}
