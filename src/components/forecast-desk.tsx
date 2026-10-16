"use client";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  ArrowClockwiseIcon,
  CaretDownIcon,
  CheckIcon,
  CopyIcon,
  CrosshairIcon,
  CloudIcon,
  CloudRainIcon,
  DropIcon,
  MagnifyingGlassIcon,
  MapTrifoldIcon,
  MoonIcon,
  SunIcon,
  ThermometerIcon,
  WarningCircleIcon,
  WindIcon,
} from "@phosphor-icons/react";
import type { Horizon, Place } from "@/features/weather/types";
import { MarketWorkspace } from "@/features/markets/workspace";
import { HORIZONS } from "@/features/weather/types";
import { useForecast } from "@/features/weather/use-forecast";
import { useBaselines } from "@/features/weather/use-baselines";
import { hex, skyScene } from "@/features/weather/sky";
import { WELCOME_FOCUS, WELCOME_TEXT } from "@/features/weather/welcome-sky";
import {
  locationHref,
  readLocation,
  readSaved,
  SAVED_POINT,
} from "@/features/location/state";
import { coordinates, formatNumber, hourLabel, offset } from "@/lib/time";
import { AnimatedBackground } from "./motion/animated-background";
import { HoverTile, HoverTiles } from "./motion/hover-tiles";
import { TransitionPanel } from "./motion/transition-panel";
import { TextShimmer } from "./motion/text-shimmer";
import { TextLoop } from "./motion/text-loop";
import { InfiniteSlider } from "./motion/infinite-slider";
import { CountryFlag } from "./flag";
import { Logo } from "./logo";
import { Conditions } from "./conditions";
import { ImportantHours } from "./important-hours";
import { LocationDialog } from "./location-dialog";
import { PrivacyNotice } from "./privacy-notice";
import { DailySummary } from "./daily-summary";
import { Sky } from "./sky";
import { WelcomeSky } from "./welcome-sky";
const GeoMap = lazy(() => import("./geo-map"));
const Charts = lazy(() =>
  import("./forecast-charts").then((module) => ({
    default: module.ForecastCharts,
  })),
);
const welcomeMetrics = [
  { label: "temperature", icon: <ThermometerIcon /> },
  { label: "solar irradiance", icon: <SunIcon /> },
  { label: "humidity", icon: <DropIcon /> },
  { label: "wind conditions", icon: <WindIcon /> },
  { label: "cloud cover", icon: <CloudIcon /> },
  { label: "precipitation", icon: <CloudRainIcon /> },
] as const;
const examples: Place[] = [
  {
    name: "Rotterdam",
    country: "Netherlands",
    countryCode: "NL",
    latitude: 51.9225,
    longitude: 4.4792,
  },
  {
    name: "Helsinki",
    country: "Finland",
    countryCode: "FI",
    latitude: 60.1695,
    longitude: 24.9354,
  },
  {
    name: "London",
    country: "United Kingdom",
    countryCode: "GB",
    latitude: 51.5019,
    longitude: -0.1187,
  },
  {
    name: "Berlin",
    country: "Germany",
    countryCode: "DE",
    latitude: 52.5238,
    longitude: 13.3996,
  },
  {
    name: "Madrid",
    country: "Spain",
    countryCode: "ES",
    latitude: 40.402,
    longitude: -3.6853,
  },
  {
    name: "Stockholm",
    country: "Sweden",
    countryCode: "SE",
    latitude: 59.3241,
    longitude: 18.0663,
  },
  {
    name: "Singapore",
    country: "Singapore",
    countryCode: "SG",
    latitude: 1.295,
    longitude: 103.8539,
  },
  {
    name: "Sydney",
    country: "Australia",
    countryCode: "AU",
    latitude: -33.8688,
    longitude: 151.2093,
  },
];
const HORIZON_KEYS = Object.keys(HORIZONS) as Horizon[];
const HORIZON_NAMES: Record<Horizon, string> = {
  "24h": "24 hours",
  "48h": "48 hours",
  "7d": "7 days",
};
const plainClick = (event: MouseEvent<HTMLAnchorElement>) =>
  event.button === 0 &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.shiftKey &&
  !event.altKey;
// Static placeholders keep the summary, chart and aside footprint while data arrives.
// The summary heading and its horizon control are real, so the horizon can change now.
function LoadingForecast({
  horizon,
  controls,
}: {
  horizon: Horizon;
  controls: ReactNode;
}) {
  // Local days in a rolling window: usually a partial day at each end.
  const rows = { "24h": 2, "48h": 3, "7d": 8 }[horizon];
  return (
    <div className="loading-forecast">
      <div className="section-heading summary-heading">
        <h2>Daily summary</h2>
        {controls}
      </div>
      <div
        className="skeleton loading-summary"
        role="status"
        style={{ "--rows": rows } as CSSProperties}
      >
        <TextShimmer as="p">Retrieving the point forecast…</TextShimmer>
        <span className="sr-only">
          Loading temperature, solar irradiance and weather conditions
        </span>
      </div>
      <div className="daily-conditions" aria-hidden="true">
        <div className="skeleton loading-conditions-heading" />
        <div className="weather-tiles">
          {Array.from({ length: 4 }, (_, i) => (
            <div className="weather-tile skeleton" key={i} />
          ))}
        </div>
      </div>
      <div className="analysis-row" aria-hidden="true">
        <div className="skeleton loading-chart" />
        <div className="analysis-aside">
          <div className="skeleton loading-hours" />
          <div className="skeleton loading-map" />
        </div>
      </div>
    </div>
  );
}
export function ForecastDesk({ mapKey }: { mapKey: string }) {
  const [place, setPlace] = useState<Place | null>(null),
    [horizon, setHorizon] = useState<Horizon>("48h");
  const [ready, setReady] = useState(false),
    [theme, setTheme] = useState<"light" | "dark">("light"),
    [welcomeStep, setWelcomeStep] = useState(0),
    [remember, setRemember] = useState(false);
  // Temperature gets two beats, sun then snow, on the same clock as the text.
  const welcomeIndex = Math.max(0, welcomeStep - 1);
  const advanceWelcome = useCallback(
    () => setWelcomeStep((step) => (step + 1) % (welcomeMetrics.length + 1)),
    [],
  );
  const [dialog, setDialog] = useState<"search" | "device" | "map" | null>(
      null,
    ),
    [notice, setNotice] = useState(""),
    [copied, setCopied] = useState(false),
    [inspectionNotice, setInspectionNotice] = useState(""),
    [selectedTime, setSelectedTime] = useState<number | null>(null),
    [focusDay, setFocusDay] = useState<string | null>(null);
  const [now, setNow] = useState(0),
    [online, setOnline] = useState(true),
    [skyFailed, setSkyFailed] = useState(false),
    themeOverride = useRef(false),
    dialogOpener = useRef<HTMLElement>(null),
    main = useRef<HTMLElement>(null);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    try {
      const preference = localStorage.getItem("saasignal:theme");
      themeOverride.current = preference === "light" || preference === "dark";
      setTheme(
        preference === "dark" || (!themeOverride.current && media.matches)
          ? "dark"
          : "light",
      );
    } catch {
      setTheme(media.matches ? "dark" : "light");
    }
    const updateTheme = () => {
      if (!themeOverride.current) setTheme(media.matches ? "dark" : "light");
    };
    media.addEventListener("change", updateTheme);
    const restore = (initial = false) => {
      try {
        const state = readLocation(location.search);
        let saved = null;
        if (initial) {
          try {
            saved = readSaved(localStorage.getItem(SAVED_POINT));
            setRemember(!!saved);
          } catch {
            setNotice(
              "The saved monitoring point could not be read. Choose a location to continue.",
            );
          }
        }
        setPlace(
          (current) =>
            state.place ??
            (initial
              ? (saved?.place ?? null)
              : current?.private
                ? current
                : null),
        );
        setHorizon(
          state.place || !initial
            ? state.horizon
            : (saved?.horizon ?? state.horizon),
        );
        if (state.view === "map") {
          setDialog("map");
          // Old map links open the picker without retaining a workspace route.
          const url = new URL(location.href);
          url.searchParams.delete("view");
          history.replaceState(null, "", `${url.pathname}${url.search}`);
        } else setDialog(null);
        setSelectedTime(null);
        setFocusDay(state.day);
      } catch {
        setPlace(null);
        setNotice(
          "This location link is incomplete or invalid. Choose a location to continue.",
        );
      }
    };
    restore(true);
    setReady(true);
    setNow(Date.now());
    setOnline(navigator.onLine);
    const pop = () => restore(),
      connection = () => {
        setOnline(navigator.onLine);
        setNow(Date.now());
      },
      visible = () => {
        if (!document.hidden) setNow(Date.now());
      };
    const timer = setInterval(visible, 30_000);
    window.addEventListener("popstate", pop);
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    document.addEventListener("visibilitychange", visible);
    return () => {
      media.removeEventListener("change", updateTheme);
      clearInterval(timer);
      window.removeEventListener("popstate", pop);
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute("content", theme === "dark" ? "#121212" : "#f7f6f3");
    });
  }, [theme]);
  const { query, refresh } = useForecast(place, horizon),
    data = query.data;
  const baselines = useBaselines(place);
  const [refreshing, setRefreshing] = useState(false);
  const manualRefresh = () => {
    if (refreshing || !navigator.onLine) return;
    setRefreshing(true);
    void refresh().finally(() => setRefreshing(false));
  };
  const age = data
    ? Math.max(
        0,
        Math.floor(
          (Math.max(now, data.source.servedAt) - data.source.retrievedAt) /
            60_000,
        ),
      )
    : 0;
  const forecast =
    data &&
    Math.max(now, data.source.servedAt) - data.source.retrievedAt <= 7_200_000
      ? data
      : undefined;
  const old = age >= 15,
    partial =
      forecast &&
      (forecast.coverage.temperature < forecast.coverage.expected ||
        forecast.coverage.solar < forecast.coverage.expected);
  // The sky pictures the modelled current weather at the point, in this appearance.
  const scene = useMemo(
    () =>
      forecast?.current && place
        ? skyScene({
            current: forecast.current,
            hourly: forecast.hourly,
            latitude: place.latitude,
            longitude: place.longitude,
            dark: theme === "dark",
          })
        : null,
    [forecast, place, theme],
  );
  const sky = scene && !skyFailed;
  const persist = (point: Place, period: Horizon) => {
    try {
      localStorage.setItem(
        SAVED_POINT,
        JSON.stringify({
          version: 1,
          place: { ...point, private: undefined },
          horizon: period,
        }),
      );
    } catch {
      setRemember(false);
      setNotice(
        "This browser could not save the monitoring point. You can still use the forecast.",
      );
    }
  };
  const navigate = (point: Place | null, period: Horizon, day = focusDay) => {
    const url = new URL(
      locationHref(point, period, false, day),
      location.origin,
    );
    if (point)
      for (const key of ["workspace", "delivery", "marketDays", "resolution"]) {
        const value = new URLSearchParams(location.search).get(key);
        if (value) url.searchParams.set(key, value);
      }
    const href = `${url.pathname}${url.search}`;
    if (href !== `${location.pathname}${location.search}`)
      history.pushState(null, "", href);
  };
  const choose = (point: Place) => {
    setPlace(point);
    setSelectedTime(null);
    setFocusDay(null);
    setNotice("");
    setCopied(false);
    navigate(point, horizon, null);
    dialogOpener.current = main.current;
    requestAnimationFrame(() => {
      main.current?.focus({ preventScroll: true });
      main.current?.scrollIntoView({ block: "start" });
    });
    if (point.private) {
      setRemember(false);
      try {
        localStorage.removeItem(SAVED_POINT);
      } catch {
        /* Session-only use remains available. */
      }
    } else if (remember) persist(point, horizon);
  };
  const openDialog = (
    mode: "search" | "device" | "map",
    opener: HTMLElement,
  ) => {
    dialogOpener.current = opener;
    setDialog(mode);
  };
  const changeHorizon = (period: Horizon) => {
    setHorizon(period);
    navigate(place, period);
    if (remember && place) persist(place, period);
  };
  const inspect = (time: number) => {
    setSelectedTime(time);
  };
  // Focusing a local day is a view refinement: it replaces, not pushes, history.
  const focus = (day: string | null) => {
    setFocusDay(day);
    setSelectedTime(null);
    const href = locationHref(place, horizon, false, day);
    if (href !== `${location.pathname}${location.search}`)
      history.replaceState(null, "", href);
  };
  const inspectSignal = (time: number) => {
    // Hours to watch span the whole window, so show all days around the cursor.
    if (focusDay) focus(null);
    inspect(time);
    const hour = forecast?.hourly.find((h) => h.time === time);
    if (hour && forecast)
      setInspectionNotice(
        `${hourLabel(time, forecast.location.timezone)}. Temperature ${formatNumber(hour.temperatureC)} degrees Celsius. Solar mean ${formatNumber(hour.solarIrradianceWm2, 0)} watts per square metre.`,
      );
    // On narrow layouts the list sits below the chart; bring the moved cursor into view.
    requestAnimationFrame(() =>
      document.getElementById("hourly")?.scrollIntoView({
        block: "nearest",
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      }),
    );
  };
  // Shortcuts for repeated desk work; ignored while typing or with a dialog or popover open.
  useEffect(() => {
    const overlayOpen = () => {
      try {
        return !!document.querySelector("[role=dialog], :popover-open");
      } catch {
        return !!document.querySelector("[role=dialog]");
      }
    };
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        target.closest("input, textarea, select, [contenteditable]") ||
        overlayOpen()
      )
        return;
      if (event.key === "/") {
        event.preventDefault();
        openDialog("search", target === document.body ? main.current! : target);
      } else if (!place) return;
      else if (event.key === "r" || event.key === "R") manualRefresh();
      else if (event.key === "1" || event.key === "2" || event.key === "3")
        changeHorizon(HORIZON_KEYS[Number(event.key) - 1]);
      else if (event.key === "Escape" && focusDay) focus(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const map = () => (
    <Suspense
      fallback={
        <div className="map-placeholder skeleton" role="status">
          Loading map…
        </div>
      }
    >
      <GeoMap
        place={place}
        theme={theme}
        mapKey={mapKey}
        onSelect={choose}
        onExpand={(opener) => openDialog("map", opener)}
      />
    </Suspense>
  );
  const placeHeading = place && (
    <div className="place-context">
      <h1 className="place-title" aria-label={place.name}>
        <button
          className="place-heading"
          onClick={(event) => openDialog("search", event.currentTarget)}
          aria-label={`Change location, currently ${place.name}`}
        >
          <CountryFlag code={place.countryCode} country={place.country} />
          <span className="city-name">
            <TransitionPanel inline activeKey={place.name}>
              {place.name}
            </TransitionPanel>
          </span>
          {place.country && <span className="country">{place.country}</span>}
          <CaretDownIcon aria-hidden="true" />
        </button>
      </h1>
      <div className="place-meta">
        {place.region && <span>{place.region}</span>}
        <span>
          {forecast
            ? forecast.location.timezoneResolved
              ? `${forecast.location.timezone} (${offset(forecast.hourly[0].time, forecast.location.timezone)})`
              : "UTC (local timezone unavailable)"
            : coordinates(place.latitude, place.longitude)}
        </span>
        <span>Point forecast</span>
      </div>
    </div>
  );
  const changeLocation = (
    <button
      className="button change-location"
      aria-keyshortcuts="/"
      title="Change location (/)"
      onClick={(event) => openDialog("search", event.currentTarget)}
    >
      <MagnifyingGlassIcon />
      Change location
    </button>
  );
  // The horizon scopes the summary, charts and hours below; it sits with their heading.
  const horizonControl = (
    <div className="segmented" role="group" aria-label="Forecast horizon">
      <AnimatedBackground value={horizon}>
        {HORIZON_KEYS.map((period, i) => (
          <button
            key={period}
            data-id={period}
            aria-pressed={horizon === period}
            aria-keyshortcuts={String(i + 1)}
            onClick={() => changeHorizon(period)}
          >
            {period}
          </button>
        ))}
      </AnimatedBackground>
    </div>
  );
  // The place header sits on a sky that pictures the modelled current weather.
  const hero = place && (
    <div
      className="hero"
      data-tone={scene?.tone}
      style={
        scene
          ? ({
              "--sky-top": hex(scene.top),
              "--sky-bottom": hex(scene.bottom),
            } as CSSProperties)
          : undefined
      }
    >
      {sky && <Sky scene={scene} onUnavailable={() => setSkyFailed(true)} />}
      <div className="context-row">
        {placeHeading}
        {changeLocation}
      </div>
      <div className="conditions-row">
        {forecast ? (
          <Conditions
            current={forecast.current}
            timezone={forecast.location.timezone}
            old={old}
          />
        ) : (
          <p className="conditions" />
        )}
        <div className="hero-actions">
          <div className="freshness" role="status">
            {forecast ? (
              <>
                <span>
                  {refreshing ? (
                    <TextShimmer>Refreshing forecast…</TextShimmer>
                  ) : (
                    `${old ? "Older forecast · " : ""}Retrieved ${age < 1 ? "just now" : `${age} min ago`}`
                  )}
                </span>
                <button
                  className="icon-button refresh-button"
                  aria-label="Refresh forecast"
                  aria-keyshortcuts="R"
                  title="Refresh forecast (R)"
                  data-busy={refreshing || undefined}
                  disabled={refreshing || !online}
                  onClick={manualRefresh}
                >
                  <ArrowClockwiseIcon />
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
  return (
    <div
      className="app"
      data-welcome={(ready && !place) || undefined}
      style={
        ready && !place
          ? ({
              "--muted": WELCOME_TEXT[theme],
              "--focus": WELCOME_FOCUS[theme],
            } as CSSProperties)
          : undefined
      }
    >
      {ready && !place && (
        <WelcomeSky
          metric={welcomeMetrics[welcomeIndex].label}
          dark={theme === "dark"}
          cold={welcomeStep === 1}
        />
      )}
      <a className="skip-link" href="#main">
        Skip to forecast
      </a>
      <header className="app-header">
        <a
          className="brand"
          translate="no"
          href="/"
          onClick={(event) => {
            if (plainClick(event)) {
              event.preventDefault();
              setPlace(null);
              navigate(null, "48h", null);
              setHorizon("48h");
            }
          }}
        >
          <Logo />
          <span className="sr-only">Säävirta</span>
        </a>
        <div className="header-end">
          <a className="text-button sign-out" href="/cdn-cgi/access/logout">
            Sign out
          </a>
          <button
            className="icon-button"
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} appearance`}
            onClick={() => {
              const next = theme === "light" ? "dark" : "light";
              themeOverride.current = true;
              setTheme(next);
              try {
                localStorage.setItem("saasignal:theme", next);
              } catch {
                /* Appearance can remain session-only. */
              }
            }}
          >
            <span className="theme-icon" data-theme={theme} aria-hidden="true">
              <MoonIcon />
              <SunIcon />
            </span>
          </button>
        </div>
      </header>
      <p className="sr-only" aria-live="polite">
        {inspectionNotice}
      </p>
      <main
        id="main"
        ref={main}
        tabIndex={-1}
        data-updating={query.isPlaceholderData || undefined}
      >
        {ready && hero}
        {notice && (
          <p className="status-message" role="status">
            {notice}
            <button className="text-button" onClick={() => setNotice("")}>
              Dismiss
            </button>
          </p>
        )}
        {!ready ? (
          <p className="initial-loading" role="status">
            Opening your weather workspace…
          </p>
        ) : !place ? (
          <div className="welcome">
            <div className="welcome-copy">
              <h1>
                <span className="welcome-prefix">The outlook for</span>{" "}
                <span className="sr-only">
                  temperature, solar irradiance, humidity, wind conditions,
                  cloud cover and precipitation.
                </span>
                <span className="welcome-metric">
                  <TextLoop index={welcomeIndex} onAdvance={advanceWelcome}>
                    {welcomeMetrics}
                  </TextLoop>
                </span>
              </h1>
              <p className="welcome-intro">
                Explore the weather shaping energy demand and generation.{" "}
                <span className="welcome-intro-ending">
                  Anywhere in the world.
                </span>
              </p>
              <div className="welcome-actions">
                <button
                  className="button primary"
                  onClick={(event) => openDialog("search", event.currentTarget)}
                >
                  <MagnifyingGlassIcon />
                  Search anywhere
                </button>
                <button
                  className="button"
                  onClick={(event) => openDialog("map", event.currentTarget)}
                >
                  <MapTrifoldIcon />
                  Choose on map
                </button>
              </div>
              <button
                className="text-button device-action"
                onClick={(event) => openDialog("device", event.currentTarget)}
              >
                <CrosshairIcon />
                Use my location
              </button>
              <p className="welcome-privacy">
                Your location is only requested if you choose Use my location.
              </p>
            </div>
            <nav
              className="welcome-cities"
              aria-label="Explore a city forecast"
            >
              <InfiniteSlider speed={36} speedOnHover={12}>
                {examples.map((example) => (
                  <a
                    href={locationHref(example, horizon)}
                    key={example.name}
                    aria-label={`${example.name}, ${example.country}`}
                    onClick={(event) => {
                      if (plainClick(event)) {
                        event.preventDefault();
                        choose(example);
                      }
                    }}
                  >
                    <CountryFlag
                      code={example.countryCode}
                      country={example.country}
                    />
                    <span className="city-name">{example.name}</span>
                  </a>
                ))}
              </InfiniteSlider>
            </nav>
          </div>
        ) : (
          <>
            {place && (
              <MarketWorkspace place={place} forecast={forecast}>
                {(!online ||
                  (forecast &&
                    (old ||
                      query.isError ||
                      forecast.source.refreshFailed))) && (
                  <div className="status-message" role="status">
                    <WarningCircleIcon aria-hidden="true" />
                    <span>
                      {!online
                        ? "You’re offline. Showing the last retrieved forecast."
                        : query.isError || forecast?.source.refreshFailed
                          ? "The refresh failed. Showing the last available forecast."
                          : "This forecast was retrieved more than 15 minutes ago."}{" "}
                      {forecast && `Retrieved ${age} minutes ago.`}
                    </span>
                    {online && (
                      <button
                        className="text-button"
                        disabled={refreshing}
                        onClick={manualRefresh}
                      >
                        Retry
                      </button>
                    )}
                  </div>
                )}
                {partial && (
                  <p className="status-message" role="status">
                    Incomplete coverage: temperature{" "}
                    {forecast.coverage.temperature}/{forecast.coverage.expected}{" "}
                    hours; irradiance {forecast.coverage.solar}/
                    {forecast.coverage.expected}. Missing values remain gaps.
                  </p>
                )}
                {forecast ? (
                  <>
                    <DailySummary
                      forecast={forecast}
                      dark={theme === "dark"}
                      baselines={{
                        data: baselines.data,
                        status: baselines.status,
                        retry: () => void baselines.refetch(),
                      }}
                      focusDay={focusDay}
                      onFocusDay={focus}
                      controls={horizonControl}
                      updating={
                        query.isPlaceholderData
                          ? `Loading ${HORIZON_NAMES[horizon]}…`
                          : undefined
                      }
                    />
                    {/* Each analysis panel is a tile; a highlight follows the pointer between them. */}
                    <HoverTiles>
                      <div className="analysis-row">
                        <HoverTile id="hourly" className="tile tile-hourly">
                          <Suspense
                            fallback={
                              <div
                                className="skeleton loading-chart"
                                role="status"
                              >
                                <span className="sr-only">
                                  Loading hourly charts
                                </span>
                              </div>
                            }
                          >
                            <Charts
                              forecast={forecast}
                              baselines={baselines.data}
                              selectedTime={selectedTime}
                              onInspect={inspect}
                              focusDay={focusDay}
                              onFocusDay={focus}
                            />
                          </Suspense>
                        </HoverTile>
                        <div className="analysis-aside">
                          <HoverTile id="hours" className="tile">
                            <ImportantHours
                              forecast={forecast}
                              selectedTime={selectedTime}
                              onInspect={inspectSignal}
                            />
                          </HoverTile>
                          <HoverTile id="map" className="tile tile-map">
                            {map()}
                          </HoverTile>
                        </div>
                      </div>
                    </HoverTiles>
                  </>
                ) : query.isPending && online ? (
                  <LoadingForecast
                    horizon={horizon}
                    controls={horizonControl}
                  />
                ) : (
                  <div className="error-content" role="alert">
                    <WarningCircleIcon size={32} />
                    <h2>The forecast couldn’t be retrieved.</h2>
                    <p>
                      {age > 120
                        ? "The last retrieval is over two hours old. Refresh to get a usable forecast."
                        : !online
                          ? "Connect to the internet, then retry. Your selected point is still here."
                          : (query.error?.message ??
                            "Try again in a moment, or choose another monitoring point.")}
                    </p>
                    <button
                      className="button primary"
                      disabled={refreshing || !online}
                      onClick={manualRefresh}
                    >
                      <ArrowClockwiseIcon />
                      Retry forecast
                    </button>
                  </div>
                )}
              </MarketWorkspace>
            )}
            {place && (
              <div className="point-preferences">
                <div>
                  <label>
                    <input
                      name="remember-point"
                      autoComplete="off"
                      type="checkbox"
                      checked={remember}
                      onChange={(event) => {
                        setRemember(event.target.checked);
                        if (event.target.checked) persist(place, horizon);
                        else {
                          try {
                            localStorage.removeItem(SAVED_POINT);
                          } catch {
                            setNotice(
                              "The browser could not clear the saved point. Clear site data in your browser settings.",
                            );
                          }
                        }
                      }}
                    />
                    {place.private
                      ? "Remember exact coordinates on this device"
                      : "Remember this monitoring point"}
                  </label>
                  {remember && (
                    <button
                      className="text-button"
                      onClick={() => {
                        try {
                          localStorage.removeItem(SAVED_POINT);
                          setRemember(false);
                          setNotice("Saved monitoring point removed.");
                        } catch {
                          setNotice(
                            "Clear site data in browser settings to remove the saved point.",
                          );
                        }
                      }}
                    >
                      Clear saved point
                    </button>
                  )}
                </div>
                <button
                  className="text-button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        new URL(
                          (() => {
                            const url = new URL(
                              locationHref(place, horizon, true, focusDay),
                              location.origin,
                            );
                            for (const key of [
                              "workspace",
                              "delivery",
                              "marketDays",
                              "resolution",
                            ]) {
                              const value = new URLSearchParams(
                                location.search,
                              ).get(key);
                              if (value) url.searchParams.set(key, value);
                            }
                            return url.href;
                          })(),
                          location.origin,
                        ).href,
                      );
                      setCopied(true);
                    } catch {
                      setNotice(
                        "The link could not be copied. Allow clipboard access and try again.",
                      );
                    }
                  }}
                >
                  <TransitionPanel
                    inline
                    activeKey={copied ? "copied" : "copy"}
                  >
                    {copied ? <CheckIcon /> : <CopyIcon />}
                  </TransitionPanel>
                  {copied
                    ? "Link copied"
                    : place.private
                      ? "Copy link with exact coordinates"
                      : "Copy forecast link"}
                </button>
                {place.private && (
                  <p className="helper">
                    Saving stores your coordinates in this browser. Copying a
                    link includes them in the address.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </main>
      <footer className="app-footer">
        <div>
          Weather data by{" "}
          <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
            Open-Meteo
          </a>
        </div>
        <details className="source-details shortcuts">
          <summary>Keyboard shortcuts</summary>
          <dl>
            <div>
              <dt>
                <kbd>/</kbd>
              </dt>
              <dd>Search for a location</dd>
            </div>
            <div>
              <dt>
                <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd>
              </dt>
              <dd>Show 24 hours, 48 hours or 7 days</dd>
            </div>
            <div>
              <dt>
                <kbd>R</kbd>
              </dt>
              <dd>Refresh the forecast</dd>
            </div>
            <div>
              <dt>
                <kbd>←</kbd> <kbd>→</kbd>
              </dt>
              <dd>
                Step an hour in the focused charts; Page Up and Page Down step a
                day
              </dd>
            </div>
            <div>
              <dt>
                <kbd>Esc</kbd>
              </dt>
              <dd>Show all days again</dd>
            </div>
          </dl>
        </details>
        {forecast ? (
          <details className="source-details">
            <summary>Source &amp; freshness</summary>
            <p>
              Retrieved{" "}
              {hourLabel(
                forecast.source.retrievedAt,
                forecast.location.timezone,
              )}
              . Retrieval time is not the model issue time. Modelled conditions
              are not a live sensor observation.
            </p>
            <p>
              Provider grid:{" "}
              {coordinates(
                forecast.location.grid.latitude,
                forecast.location.grid.longitude,
              )}
              . The marker keeps your requested point.
            </p>
            <p>
              Solar irradiance is global horizontal shortwave radiation,
              averaged over the preceding hour. All times use{" "}
              {forecast.location.timezone}.
            </p>
          </details>
        ) : (
          <span>Temperature in °C · Irradiance in W/m²</span>
        )}
        <PrivacyNotice />
      </footer>
      <LocationDialog
        open={dialog !== null}
        mode={dialog ?? "search"}
        place={place}
        theme={theme}
        mapKey={mapKey}
        onClose={() => setDialog(null)}
        onRestoreFocus={() =>
          (dialogOpener.current?.isConnected
            ? dialogOpener.current
            : main.current
          )?.focus({ preventScroll: true })
        }
        onSelect={choose}
      />
    </div>
  );
}
