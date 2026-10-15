import { describe, expect, it } from "vitest";
import { contrast, linear, luminance } from "../../src/features/weather/sky";
import {
  welcomeSky,
  WELCOME_TEXT,
  WELCOME_FOCUS,
} from "../../src/features/weather/welcome-sky";

const metrics = [
  "temperature",
  "solar irradiance",
  "humidity",
  "wind conditions",
  "cloud cover",
  "precipitation",
] as const;

describe("illustrative welcome skies", () => {
  it("keeps small text readable across every scene, blend and fallback in both themes", () => {
    for (const dark of [false, true]) {
      const foreground = luminance(
        linear(WELCOME_TEXT[dark ? "dark" : "light"]),
      );
      const focus = luminance(linear(WELCOME_FOCUS[dark ? "dark" : "light"]));
      const scenes = [
        ...metrics.map((metric) => welcomeSky(metric, dark)),
        welcomeSky("temperature", dark, true),
      ];
      for (const scene of scenes) {
        // Include headroom for shader dithering and 8-bit colour quantisation.
        expect(
          contrast(foreground, dark ? scene.maxL + 0.003 : scene.minL - 0.003),
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrast(focus, dark ? scene.maxL + 0.003 : scene.minL - 0.003),
        ).toBeGreaterThanOrEqual(3);
        for (const color of [scene.top, scene.bottom]) {
          expect(contrast(foreground, luminance(color))).toBeGreaterThanOrEqual(
            4.5,
          );
        }
        expect(scene.storm).toBe(0);
      }
    }
  });

  it("gives each metric its intended effect without carrying rain into other scenes", () => {
    for (const dark of [false, true]) {
      const warm = welcomeSky("temperature", dark);
      const cold = welcomeSky("temperature", dark, true);
      expect(warm.sun).toBe(1);
      expect(warm.snow).toBe(0);
      expect(cold.sun).toBe(0);
      expect(cold.snow).toBeGreaterThan(0);
    }
    expect(welcomeSky("solar irradiance", false).sun).toBe(1);
    expect(welcomeSky("humidity", false).fog).toBe(1);
    expect(welcomeSky("wind conditions", false).gusts).toBe(1);
    expect(welcomeSky("cloud cover", false).cover).toBeGreaterThan(0.9);
    for (const metric of metrics)
      expect(welcomeSky(metric, false).rain > 0).toBe(
        metric === "precipitation",
      );
  });
});
