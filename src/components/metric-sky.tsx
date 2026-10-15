"use client";
import { useMemo, useState } from "react";
import { hex } from "@/features/weather/sky";
import type { WelcomeMetric } from "@/features/weather/welcome-sky";
import { metricSky } from "@/features/weather/metric-sky";
import { Sky } from "./sky";

export function MetricSky({
  metric,
  dark,
  cold = false,
}: {
  metric: WelcomeMetric;
  dark: boolean;
  cold?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const scene = useMemo(
    () => metricSky(metric, dark, cold),
    [metric, dark, cold],
  );
  return failed ? (
    <div
      className="metric-backdrop"
      aria-hidden="true"
      style={{
        background: `linear-gradient(${hex(scene.top)}, ${hex(scene.bottom)})`,
      }}
    />
  ) : (
    <Sky
      scene={scene}
      className="metric-backdrop"
      animateOnHover
      onUnavailable={() => setFailed(true)}
    />
  );
}
