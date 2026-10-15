import { env } from "cloudflare:workers";
import { ForecastDesk } from "@/components/forecast-desk";
export default function Page() {
  return <ForecastDesk mapKey={env.PUBLIC_MAPTILER_KEY || ""} />;
}
