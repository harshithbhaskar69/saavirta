"use client";
import { CaretDownIcon } from "@phosphor-icons/react";
import { InfoTip } from "@/components/info-tip";
import {
  Disclosure,
  DisclosureContent,
  DisclosureTrigger,
} from "@/components/motion/disclosure";
import type { Dashboard, Interval, MarketSeries } from "./contracts";
import { deliveryLabel } from "./presentation";

const number = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

function explanation(metric: Dashboard["metrics"][number]) {
  switch (metric.formulaVersion) {
    case "residual-load/v1":
      return {
        question: "What is residual load?",
        summary: "Demand remaining after forecast wind and solar generation.",
        formula: "Demand forecast − wind forecast − solar forecast",
        alignment: "All three inputs use the same delivery interval.",
      };
    case "consumption-error/v1":
      return {
        question: "What does consumption error mean?",
        summary:
          "Actual demand compared with the forecast collected about 24 hours earlier.",
        formula:
          metric.unit === "%"
            ? "100 × (actual demand − earlier forecast) ÷ earlier forecast"
            : "Actual demand − earlier forecast",
        alignment:
          "Completed delivery intervals only. The baseline is collected at least 24 hours before delivery, within a 30-minute tolerance.",
      };
    case "observed-revision/v1":
      return {
        question: "What does this forecast change mean?",
        summary: "Change since the forecast collected about one hour earlier.",
        formula: "Latest forecast − earlier forecast",
        alignment:
          "Both forecasts use the same delivery interval. The earlier collection is at least one hour older, within a 30-minute tolerance.",
      };
    default:
      return {
        question: metric.label,
        summary: "Derived from the collected inputs for this delivery period.",
        formula: metric.formulaVersion,
        alignment: metric.limitations,
      };
  }
}

export function MetricCard({
  metric,
  point,
  series,
  demonstration,
}: {
  metric: Dashboard["metrics"][number];
  point: Interval | undefined;
  series: MarketSeries[];
  demonstration: boolean;
}) {
  const label = `${metric.label}${metric.unit === "%" ? " (%)" : ""}`;
  const copy = explanation(metric);
  const collections = new Map<string, string[]>();
  for (const input of point?.inputs ?? []) {
    const labels = collections.get(input.collectedAt) ?? [];
    labels.push(
      series.find((s) => s.id === input.seriesId)?.label ?? input.seriesId,
    );
    collections.set(input.collectedAt, labels);
  }
  return (
    <article>
      <div className="market-metric-heading">
        <h4>{label}</h4>
        <InfoTip label={`About ${label}`}>
          <h5>{copy.question}</h5>
          <p>{metric.limitations}</p>
        </InfoTip>
      </div>
      <p className="market-metric-value">
        {point?.value != null ? (
          <>
            {number.format(point.value)} <span>{metric.unit}</span>
          </>
        ) : point?.missingReason === "history-collecting" ? (
          "History collecting"
        ) : (
          "Unavailable"
        )}
      </p>
      <p className="market-metric-summary">{copy.summary}</p>
      <Disclosure>
        <div className="market-metric-footer">
          {point?.value != null && (
            <span
              className="market-metric-status"
              data-warning={metric.quality.freshness !== "fresh"}
            >
              {metric.quality.freshness === "fresh"
                ? "Fresh inputs"
                : metric.quality.freshness === "stale"
                  ? "Stale inputs"
                  : "Freshness unknown"}
            </span>
          )}
          <DisclosureTrigger>
            <button
              className="market-metric-trigger"
              aria-label={`Methodology for ${label}`}
            >
              Methodology <CaretDownIcon aria-hidden="true" />
            </button>
          </DisclosureTrigger>
        </div>
        <DisclosureContent>
          <div className="market-metric-details">
            <h5>Calculation</h5>
            <p className="market-metric-formula">{copy.formula}</p>
            <p>{copy.alignment}</p>
            <div className="market-metric-provenance">
              <p>
                Source:{" "}
                {demonstration
                  ? "Synthetic demonstration data"
                  : "Fingrid Open Data"}
              </p>
              <dl className="market-input-collections">
                {[...collections].map(([collectedAt, labels]) => (
                  <div key={collectedAt}>
                    <dt>{labels.join(" · ")}</dt>
                    <dd>
                      Collected{" "}
                      <time dateTime={collectedAt}>
                        {deliveryLabel(collectedAt)}
                      </time>
                    </dd>
                  </div>
                ))}
              </dl>
              {collections.size === 0 && (
                <p>No input collections available for this period.</p>
              )}
              <p>
                Coverage: {Math.round(metric.quality.coverage * 100)}% of
                selected delivery periods
              </p>
            </div>
          </div>
        </DisclosureContent>
      </Disclosure>
    </article>
  );
}
