import { env } from "cloudflare:workers";
export async function GET() {
  await env.WEATHER_CACHE.get("health-probe");
  return Response.json({ status: "ok", runtime: "workerd" });
}
