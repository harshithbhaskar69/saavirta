// The sky behind the place header pictures the *modelled* current weather at the
// point: Open-Meteo's WMO code and day flag, the nearest hourly cloud cover and
// wind, and the sun's real position. It is never presented as an observation.
// Colours are linear-light RGB so the shader can blend and bound luminance exactly.
import type { CurrentConditions, Hour } from "./types";

export type RGB = [number, number, number];
export type SkyTone = "light" | "dark";
export type SkyScene = {
  /** Text tone over the sky: dark text on light skies, light text on dark ones. */
  tone: SkyTone;
  top: RGB;
  bottom: RGB;
  lit: RGB;
  shade: RGB;
  haze: RGB;
  sunColor: RGB;
  cover: number;
  cloudScale: number;
  sun: number;
  sunSpread: number;
  sunX: number;
  sunY: number;
  stars: number;
  rain: number;
  snow: number;
  fog: number;
  storm: number;
  wind: number;
  /** Illustrative welcome trails; absent from modelled weather scenes. */
  gusts?: number;
  /** Illustrative detail for metric cards, absent from the modelled sky. */
  dew?: number;
  heat?: number;
  rays?: number;
  /** Every rendered pixel stays inside [minL, maxL] relative luminance. */
  minL: number;
  maxL: number;
};

// The luminance window behind header text, and the text colours it is built for.
// Dark text needs a sky at least LIGHT_FLOOR bright; light text one at most
// DARK_CEILING bright. Both keep 4.5:1 for 12px muted text (tests/unit/sky.test.ts).
export const LIGHT_FLOOR = 0.34;
export const DARK_CEILING = 0.115;
export const SKY_TEXT = {
  light: { ink: "#192025", muted: "#28343c" },
  dark: { ink: "#f3f6f7", muted: "#d9e2e7" },
} as const;

const channel = (value: number) => {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
export const linear = (hex: string): RGB => [
  channel(parseInt(hex.slice(1, 3), 16)),
  channel(parseInt(hex.slice(3, 5), 16)),
  channel(parseInt(hex.slice(5, 7), 16)),
];
export const luminance = ([r, g, b]: RGB) =>
  0.2126 * r + 0.7152 * g + 0.0722 * b;
export const contrast = (a: number, b: number) =>
  (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const encode = (value: number) => {
  const v = Math.min(1, Math.max(0, value));
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
  return Math.round(c * 255)
    .toString(16)
    .padStart(2, "0");
};
export const hex = (rgb: RGB) => `#${rgb.map(encode).join("")}`;
const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));
// Moves a colour into the window: lifting adds grey (adding d to every channel adds
// exactly d to luminance); lowering scales, which keeps the hue.
const fit = (rgb: RGB, min: number, max: number): RGB => {
  const L = luminance(rgb);
  if (L < min) return rgb.map((v) => v + min - L) as RGB;
  if (L > max) return rgb.map((v) => (v * max) / L) as RGB;
  return rgb;
};

type Palette = Record<"top" | "bottom" | "lit" | "shade" | "haze", RGB>;
const palette = (
  top: string,
  bottom: string,
  lit: string,
  shade: string,
  haze: string,
): Palette => ({
  top: linear(top),
  bottom: linear(bottom),
  lit: linear(lit),
  shade: linear(shade),
  haze: linear(haze),
});
const blend = (a: Palette, b: Palette, t: number): Palette => ({
  top: mix(a.top, b.top, t),
  bottom: mix(a.bottom, b.bottom, t),
  lit: mix(a.lit, b.lit, t),
  shade: mix(a.shade, b.shade, t),
  haze: mix(a.haze, b.haze, t),
});
// Dark appearance dims daylight skies slightly so they do not glare in a dark page;
// fit() later lifts anything the dimming pushed below the light-sky floor.
const dim = (p: Palette): Palette => {
  const k = (rgb: RGB): RGB => [rgb[0] * 0.82, rgb[1] * 0.82, rgb[2] * 0.82];
  return {
    top: k(p.top),
    bottom: k(p.bottom),
    lit: k(p.lit),
    shade: k(p.shade),
    haze: k(p.haze),
  };
};

const DAY = {
  light: {
    clear: palette("#76abdc", "#d3e6f2", "#ffffff", "#c8d4de", "#e7edf0"),
    overcast: palette("#a7b3bd", "#cdd6dc", "#eceff2", "#a1adb7", "#dde3e7"),
  },
  dark: {
    clear: palette("#6e9cc7", "#a2bed3", "#dfe7ec", "#a3b2bf", "#c6d0d6"),
    overcast: palette("#98a4ae", "#b3bdc4", "#d3d9de", "#939faa", "#c4ccd1"),
  },
};
const RAIN_DAY = palette("#9aa7b2", "#c0cad1", "#dfe5e9", "#97a4af", "#d2d9de");
const SNOW_DAY = palette("#b6c1cb", "#dee5ea", "#f5f8fa", "#b2bdc7", "#e9eef1");
const FOG_DAY = palette("#b5bec5", "#d6dce0", "#e4e8eb", "#b0b9c0", "#e2e7ea");
const NIGHT = {
  clear: palette("#0a1530", "#1d2d4e", "#3a4562", "#1b2236", "#2a3245"),
  overcast: palette("#151a25", "#252c3a", "#3b4352", "#1f242e", "#2d3440"),
};
const STORM = {
  day: palette("#2a333f", "#434d59", "#56606c", "#262d36", "#3a434d"),
  night: palette("#11151c", "#20262f", "#3a414b", "#161a20", "#272d35"),
};
const WARM = { light: linear("#f2cda6"), dark: linear("#d4b08f") };
const TWILIGHT = linear("#2b3b5c");
const SUN = { high: linear("#fff4dc"), low: linear("#ffcf96") };

type Weather = {
  cover: number;
  rain?: number;
  snow?: number;
  fog?: number;
  showers?: boolean;
  storm?: boolean;
};
// WMO weather interpretation codes as Open-Meteo reports them.
const CODES: Record<number, Weather> = {
  0: { cover: 0 },
  1: { cover: 0.2 },
  2: { cover: 0.5 },
  3: { cover: 0.95 },
  45: { cover: 0.85, fog: 0.85 },
  48: { cover: 0.85, fog: 0.9 },
  51: { cover: 0.85, rain: 0.25, fog: 0.2 },
  53: { cover: 0.88, rain: 0.35, fog: 0.2 },
  55: { cover: 0.9, rain: 0.45, fog: 0.25 },
  56: { cover: 0.88, rain: 0.3, fog: 0.2 },
  57: { cover: 0.9, rain: 0.45, fog: 0.25 },
  61: { cover: 0.9, rain: 0.45 },
  63: { cover: 0.95, rain: 0.65 },
  65: { cover: 1, rain: 0.9, fog: 0.15 },
  66: { cover: 0.92, rain: 0.5 },
  67: { cover: 1, rain: 0.85 },
  71: { cover: 0.9, snow: 0.35 },
  73: { cover: 0.95, snow: 0.6 },
  75: { cover: 1, snow: 0.9, fog: 0.2 },
  77: { cover: 0.9, snow: 0.3 },
  80: { cover: 0.6, rain: 0.45, showers: true },
  81: { cover: 0.7, rain: 0.65, showers: true },
  82: { cover: 0.8, rain: 0.9, showers: true },
  85: { cover: 0.65, snow: 0.45, showers: true },
  86: { cover: 0.8, snow: 0.8, showers: true },
  95: { cover: 1, rain: 0.7, storm: true },
  96: { cover: 1, rain: 0.8, storm: true },
  99: { cover: 1, rain: 0.9, storm: true },
};

const RAD = Math.PI / 180;
/** Low-precision solar position (about 1°), enough to place the sun and warm the horizon. */
export function sunPosition(time: number, latitude: number, longitude: number) {
  const d = time / 86_400_000 - 10_957.5; // days since J2000.0
  const g = (357.529 + 0.98560028 * d) * RAD;
  const q = 280.459 + 0.98564736 * d;
  const lambda = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const epsilon = (23.439 - 0.00000036 * d) * RAD;
  const ra = Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda));
  const dec = Math.asin(Math.sin(epsilon) * Math.sin(lambda));
  const gmst = 18.697374558 + 24.06570982441908 * d;
  const turn = 2 * Math.PI;
  const hourAngle =
    (((((gmst * 15 + longitude) * RAD - ra) % turn) + 3 * Math.PI) % turn) -
    Math.PI;
  const lat = latitude * RAD;
  const elevation = Math.asin(
    Math.sin(lat) * Math.sin(dec) +
      Math.cos(lat) * Math.cos(dec) * Math.cos(hourAngle),
  );
  return { elevation: elevation / RAD, hourAngle: hourAngle / RAD };
}

const nearest = (hourly: Hour[], time: number) =>
  hourly.reduce<Hour | undefined>(
    (best, h) =>
      !best || Math.abs(h.time - time) < Math.abs(best.time - time) ? h : best,
    undefined,
  );

export function skyScene({
  current,
  hourly,
  latitude,
  longitude,
  dark,
}: {
  current: CurrentConditions;
  hourly: Hour[];
  latitude: number;
  longitude: number;
  dark: boolean;
}): SkyScene {
  const sample = nearest(hourly, current.time);
  const known =
    current.weatherCode === null ? undefined : CODES[current.weatherCode];
  const cloud =
    sample?.cloudCoverPct === null || sample?.cloudCoverPct === undefined
      ? null
      : clamp(sample.cloudCoverPct / 100);
  const w: Weather = known ?? { cover: cloud ?? 0.5 };
  // Hourly cloud cover refines fair weather and showers; it only thickens rain, snow and fog.
  const fair = (current.weatherCode ?? 0) <= 3 || w.showers;
  const cover =
    cloud === null
      ? w.cover
      : fair
        ? Math.max(cloud, w.showers ? 0.35 : 0)
        : Math.max(w.cover, cloud);
  const storm = !!w.storm,
    day = current.isDay,
    tone: SkyTone = day && !storm ? "light" : "dark";
  const { elevation, hourAngle } = sunPosition(
    current.time,
    latitude,
    longitude,
  );
  const theme = dark ? "dark" : "light";
  let p: Palette;
  if (storm) p = day ? STORM.day : STORM.night;
  else if (!day) p = blend(NIGHT.clear, NIGHT.overcast, cover);
  else if (w.snow && !w.showers) p = dark ? dim(SNOW_DAY) : SNOW_DAY;
  else if (w.rain && !w.showers) p = dark ? dim(RAIN_DAY) : RAIN_DAY;
  else if ((w.fog ?? 0) > 0.5) p = dark ? dim(FOG_DAY) : FOG_DAY;
  else p = blend(DAY[theme].clear, DAY[theme].overcast, cover ** 1.6);
  // Golden hour warms the horizon of a clearish day; civil twilight tints the night.
  const golden =
    day && !storm ? clamp(1 - Math.max(0, elevation) / 10) * (1 - cover) : 0;
  if (golden) {
    p = {
      ...p,
      bottom: mix(p.bottom, WARM[theme], golden * 0.8),
      top: mix(p.top, WARM[theme], golden * 0.2),
    };
  }
  if (!day && elevation > -6)
    p = { ...p, bottom: mix(p.bottom, TWILIGHT, (1 + elevation / 6) * 0.6) };
  const [minL, maxL] = tone === "light" ? [LIGHT_FLOOR, 1] : [0, DARK_CEILING];
  const bound = (rgb: RGB) => fit(rgb, minL, maxL);
  return {
    tone,
    top: bound(p.top),
    bottom: bound(p.bottom),
    lit: bound(p.lit),
    shade: bound(p.shade),
    haze: bound(p.haze),
    sunColor: mix(SUN.high, SUN.low, golden),
    cover,
    cloudScale: 1,
    sunSpread: 1,
    sun: day && !storm ? 1 : 0,
    // Morning sun sits left, evening sun right; height follows elevation.
    sunX: clamp(0.5 + hourAngle / 225, 0.1, 0.9),
    sunY: 0.9 - clamp(elevation / 50) * 0.72,
    stars: day ? 0 : 1 - cover,
    rain: w.rain ?? 0,
    snow: w.snow ?? 0,
    fog: w.fog ?? 0,
    storm: storm ? 1 : 0,
    wind:
      sample?.windSpeedMs === null || sample?.windSpeedMs === undefined
        ? 0.2
        : clamp(sample.windSpeedMs / 14),
    minL,
    maxL,
  };
}
