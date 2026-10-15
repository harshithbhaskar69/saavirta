"use client";
import { useMemo, useState, type CSSProperties } from "react";
import { hex } from "@/features/weather/sky";
import { welcomeSky, type WelcomeMetric } from "@/features/weather/welcome-sky";
import { useReducedMotion } from "./motion/use-reduced-motion";
import { Sky } from "./sky";

export function WelcomeSky({
  metric,
  dark,
  cold,
}: {
  metric: WelcomeMetric;
  dark: boolean;
  cold: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const reduce = useReducedMotion();
  const active = reduce ? "cloud cover" : metric;
  const scene = useMemo(
    () => welcomeSky(active, dark, cold),
    [active, dark, cold],
  );
  return (
    <div
      className="welcome-sky"
      data-metric={active}
      data-temperature={
        active === "temperature" ? (cold ? "snow" : "sun") : undefined
      }
      aria-hidden="true"
      style={
        {
          "--sky-top": hex(scene.top),
          "--sky-bottom": hex(scene.bottom),
        } as CSSProperties
      }
    >
      {/* Restart on appearance changes so text never crosses a sky of the opposite tone. */}
      {!failed && (
        <Sky
          key={scene.tone}
          scene={scene}
          onUnavailable={() => setFailed(true)}
        />
      )}
    </div>
  );
}
