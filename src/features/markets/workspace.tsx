"use client";
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import type { Forecast, Place } from "@/features/weather/types";
import { useMarketContext } from "./use-markets";
import { marketHref, readMarketSettings } from "./state";
import type { MarketSettings } from "./contracts";
const MarketDesk = lazy(() => import("./market-desk"));

export function MarketWorkspace({
  place,
  forecast,
  children,
}: {
  place: Place;
  forecast?: Forecast;
  children: ReactNode;
}) {
  const context = useMarketContext(place);
  const [workspace, setWorkspace] = useState<"weather" | "markets">("weather");
  const [settings, setSettings] = useState<MarketSettings>(() =>
    readMarketSettings(""),
  );
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const restore = () => {
      setWorkspace(
        new URLSearchParams(location.search).get("workspace") === "markets"
          ? "markets"
          : "weather",
      );
      setSettings(readMarketSettings(location.search));
    };
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  useEffect(() => setNotice(""), [place.latitude, place.longitude]);
  const eligible = context.data?.geographicStatus === "inside";
  useEffect(() => {
    if (workspace === "markets" && context.data && !eligible) {
      setWorkspace("weather");
      setNotice(
        context.data.geographicStatus === "outside"
          ? "This point is outside the supported Finland area. Showing Weather."
          : "Market eligibility is uncertain for this point. Showing Weather.",
      );
      const url = new URL(location.href);
      url.searchParams.delete("workspace");
      history.replaceState(null, "", `${url.pathname}${url.search}`);
    }
  }, [workspace, eligible, context.data]);
  function navigate(next: "weather" | "markets", nextSettings = settings) {
    setWorkspace(next);
    setSettings(nextSettings);
    setNotice("");
    const href = marketHref(
      `${location.pathname}${location.search}`,
      next,
      nextSettings,
    );
    if (href !== `${location.pathname}${location.search}`)
      history.pushState(null, "", href);
  }
  return (
    <>
      {eligible && (
        <nav className="market-navigation" aria-label="Workspace">
          <button
            aria-pressed={workspace === "weather"}
            onClick={() => navigate("weather")}
          >
            Weather
          </button>
          <button
            aria-pressed={workspace === "markets"}
            onClick={() => navigate("markets")}
          >
            Energy Markets
          </button>
        </nav>
      )}
      {notice && (
        <p className="status-message" role="status">
          {notice}
        </p>
      )}
      {context.data?.demonstration && (
        <p className="status-message">
          Demonstration data. Market values and eligibility neighbourhoods are
          synthetic.
        </p>
      )}
      {workspace === "markets" && eligible ? (
        <Suspense fallback={<p role="status">Loading the Delivery desk…</p>}>
          <MarketDesk
            place={place}
            forecast={forecast}
            settings={settings}
            onSettings={(value) => navigate("markets", value)}
          />
        </Suspense>
      ) : workspace === "markets" && !context.data ? (
        <div className="market-empty" role="status">
          <h2>
            {context.isError
              ? "Energy Markets is unavailable"
              : "Checking market eligibility…"}
          </h2>
          <p>
            {context.error?.message ??
              "Validating this selected point against the market boundary."}
          </p>
          {context.isError && (
            <button className="button" onClick={() => void context.refetch()}>
              Retry markets
            </button>
          )}
          <button className="button" onClick={() => navigate("weather")}>
            Show Weather
          </button>
        </div>
      ) : (
        children
      )}
    </>
  );
}
