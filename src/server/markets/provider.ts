import { boundedText } from "@/lib/bounded-body";
import { day, hour, minute } from "./time";

export interface ProviderState {
  next: number;
  cooldown: number;
  requests: number[];
}
export interface ProviderStateStore {
  read(): Promise<ProviderState>;
  write(state: ProviderState): Promise<void>;
}
export class ProviderError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "ProviderError";
  }
}
export interface ProviderTransport {
  get(url: URL, headers: HeadersInit, signal: AbortSignal): Promise<string>;
}
export function retryAt(value: string | null, now: number): number {
  if (value !== null && /^\d+$/.test(value))
    return now + Math.min(Number(value), 86400) * 1000;
  const date = value === null ? NaN : Date.parse(value);
  return Number.isFinite(date)
    ? Math.max(now, Math.min(date, now + day))
    : now + 10 * minute;
}
async function pause(milliseconds: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  if (milliseconds <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const abort = (): void => {
      clearTimeout(timer);
      reject(new ProviderError("provider-cancelled"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    signal.addEventListener("abort", abort, { once: true });
  });
}
// One collector owns this transport; quota reservations survive alarms and deployments.
export class ProviderClient implements ProviderTransport {
  constructor(
    private readonly provider: "fingrid" | "entsoe",
    private readonly state: ProviderStateStore,
    private readonly send: typeof fetch = (input, init) => fetch(input, init),
    private readonly now: () => number = Date.now,
  ) {}
  async get(
    url: URL,
    headers: HeadersInit,
    signal: AbortSignal,
  ): Promise<string> {
    const host =
      this.provider === "fingrid" ? "data.fingrid.fi" : "web-api.tp.entsoe.eu";
    if (
      url.protocol !== "https:" ||
      url.hostname !== host ||
      url.port ||
      url.username ||
      url.password
    )
      throw new ProviderError("provider-request-invalid");
    const spacing = this.provider === "fingrid" ? 2500 : 200;
    for (let attempt = 0; attempt < 2; attempt++) {
      signal.throwIfAborted();
      const state = await this.state.read(),
        now = this.now();
      if (state.cooldown > now) throw new ProviderError("provider-cooldown");
      const quotaWindow = this.provider === "fingrid" ? day : minute;
      state.requests = state.requests.filter(
        (time) => time > now - quotaWindow,
      );
      if (state.requests.length >= (this.provider === "fingrid" ? 9000 : 300))
        throw new ProviderError("provider-budget-exhausted");
      await pause(state.next - now, signal);
      state.requests.push(this.now());
      // Reserve a full request timeout before I/O; an interrupted process cannot burst on restart.
      state.next = this.now() + 8000 + spacing;
      await this.state.write(state);
      let response: Response;
      let raw: string;
      try {
        response = await this.send(url, {
          headers,
          signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
          redirect: "manual",
          cache: "no-store",
        });
        raw = await boundedText(response.body, 8 * 1024 * 1024);
      } catch {
        state.next = this.now() + spacing;
        await this.state.write(state);
        if (signal.aborted) throw new ProviderError("provider-cancelled");
        if (attempt === 0) continue;
        throw new ProviderError("provider-unreachable");
      }
      state.next = this.now() + spacing;
      if (response.status === 401 || response.status === 403)
        state.cooldown = this.now() + hour;
      if (response.status === 429 || response.status === 503)
        state.cooldown = retryAt(
          response.headers.get("Retry-After"),
          this.now(),
        );
      await this.state.write(state);
      if (response.ok) return raw;
      if (response.status === 401 || response.status === 403)
        throw new ProviderError("provider-authentication");
      if (response.status === 429 || response.status === 503)
        throw new ProviderError("provider-rate-limited");
      if (response.status >= 500 && attempt === 0) continue;
      throw new ProviderError("provider-rejected");
    }
    throw new ProviderError("provider-unavailable");
  }
}
