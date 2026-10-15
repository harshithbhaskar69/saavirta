// Illustrative scenes for the welcome copy, never forecast or observation data.
import { LIGHT_FLOOR, SKY_TEXT, linear, type SkyScene } from "./sky";

const moods = {
  temperature: {
    light: ["#a5cce5", "#f5d8a6"],
    dark: ["#19344b", "#4a4137"],
    effects: { sun: 1, cover: 0.18 },
  },
  "solar irradiance": {
    light: ["#b7d7ed", "#f3dfb4"],
    dark: ["#183953", "#394957"],
    effects: { sun: 1, cover: 0.12 },
  },
  humidity: {
    light: ["#86acb7", "#cbdfdc"],
    dark: ["#172e30", "#283d3b"],
    effects: { fog: 1, cover: 0.55 },
  },
  "wind conditions": {
    light: ["#b8d0df", "#dce6ed"],
    dark: ["#172b3c", "#293d49"],
    effects: { gusts: 1, wind: 1, cover: 0.22 },
  },
  "cloud cover": {
    light: ["#9ab5cb", "#cedce6"],
    dark: ["#1d2937", "#303c49"],
    effects: { cover: 0.92, wind: 0.45 },
  },
  precipitation: {
    light: ["#91abba", "#bed0dc"],
    dark: ["#172736", "#293948"],
    effects: { rain: 1, cover: 0.85, fog: 0.1, wind: 0.4 },
  },
} satisfies Record<
  string,
  {
    light: [string, string];
    dark: [string, string];
    effects: Partial<SkyScene>;
  }
>;

export type WelcomeMetric = keyof typeof moods;
export const WELCOME_TEXT = {
  light: SKY_TEXT.light.muted,
  dark: "#f0f4f6",
};
export const WELCOME_FOCUS = { light: "#0b4f86", dark: "#a9d6f5" };

const snowfall = {
  light: ["#92b3cc", "#d9e5ed"],
  dark: ["#132a41", "#263c52"],
  effects: { snow: 0.55, cover: 0.72, wind: 0.35 },
};

export function welcomeSky(
  metric: WelcomeMetric,
  dark: boolean,
  cold = false,
): SkyScene {
  const mood = metric === "temperature" && cold ? snowfall : moods[metric];
  const [top, bottom] = mood[dark ? "dark" : "light"];
  return {
    tone: dark ? "dark" : "light",
    top: linear(top),
    bottom: linear(bottom),
    lit: linear(dark ? "#47637a" : "#f7f8f9"),
    shade: linear(dark ? "#192a3c" : "#54758f"),
    haze: linear(dark ? "#344e58" : "#c5dcdb"),
    sunColor: linear(dark ? "#f5ce8d" : "#ffdaa0"),
    sunSpread: 2.8,
    sunX: 0.78,
    sunY: 0.23,
    sun: 0,
    stars: 0,
    rain: 0,
    snow: 0,
    fog: 0,
    storm: 0,
    wind: 0.2,
    cloudScale: 2.8,
    // Keep the smaller privacy and footer copy above 4.5:1, too.
    minL: dark ? 0 : LIGHT_FLOOR,
    maxL: dark ? 0.15 : 1,
    ...mood.effects,
  };
}
