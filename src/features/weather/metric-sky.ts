// Card compositions: each weather process needs to read at a much smaller scale.
import { linear, type SkyScene } from "./sky";
import { welcomeSky, type WelcomeMetric } from "./welcome-sky";

export function metricSky(
  metric: WelcomeMetric,
  dark: boolean,
  cold = false,
): SkyScene {
  const scene = {
    ...welcomeSky(metric, dark, cold),
    // Stronger detail is safe here because card labels use a stronger text tone.
    minL: dark ? 0 : 0.46,
    maxL: dark ? 0.12 : 1,
    cover: 0,
    fog: 0,
    sun: 0,
    cloudScale: 4,
  };
  switch (metric) {
    case "temperature":
      return {
        ...scene,
        top: linear(
          dark ? (cold ? "#152c46" : "#482b24") : cold ? "#accce4" : "#f5d8bd",
        ),
        bottom: linear(
          dark ? (cold ? "#293f59" : "#28202a") : cold ? "#e4eff6" : "#fff3e1",
        ),
        sunColor: linear(dark ? "#d98045" : "#d68b46"),
        heat: cold ? 0 : 1,
        snow: cold ? 0.8 : 0,
        cover: cold ? 0.15 : 0,
      };
    case "solar irradiance":
      return {
        ...scene,
        top: linear(dark ? "#18334b" : "#f7e4b5"),
        bottom: linear(dark ? "#3b3c2e" : "#fff7df"),
        sun: 1,
        rays: 1,
        sunX: 0.87,
        sunY: 0.28,
        sunSpread: 1.8,
        maxL: dark ? 0.18 : 1,
        sunColor: linear(dark ? "#ffd27b" : "#dca237"),
      };
    case "humidity":
      return {
        ...scene,
        top: linear(dark ? "#133b40" : "#b5d9d9"),
        bottom: linear(dark ? "#20343a" : "#e5f2ed"),
        lit: linear(dark ? "#a1e1d9" : "#ffffff"),
        shade: linear(dark ? "#091f2c" : "#588e99"),
        haze: linear(dark ? "#315d60" : "#b9ded8"),
        fog: 0.35,
        dew: 1,
      };
    case "wind conditions":
      return {
        ...scene,
        top: linear(dark ? "#1d302c" : "#d1e2d9"),
        bottom: linear(dark ? "#263d39" : "#edf3e9"),
        lit: linear(dark ? "#a1c8b7" : "#688f83"),
        gusts: 2.2,
        wind: 1,
      };
    case "cloud cover":
      return {
        ...scene,
        top: linear(dark ? "#172332" : "#aebed0"),
        bottom: linear(dark ? "#303e50" : "#edf1f5"),
        lit: linear(dark ? "#71849b" : "#ffffff"),
        shade: linear(dark ? "#132032" : "#788ba5"),
        cover: 0.75,
        wind: 1.8,
      };
    case "precipitation":
      return {
        ...scene,
        top: linear(dark ? "#1c2d4e" : "#bacde8"),
        bottom: linear(dark ? "#233d58" : "#e3ecf7"),
        lit: linear(dark ? "#a5c9f8" : "#4f78ad"),
        rain: 1,
        wind: 0.55,
      };
  }
}
