import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import {
  contextSchema,
  dashboardSchema,
  pointInputSchema,
  dashboardInputSchema,
  problemSchema,
} from "../src/features/markets/contracts.ts";

const schemas = {
  MarketContextResponse: contextSchema,
  Dashboard: dashboardSchema,
  PointInput: pointInputSchema,
  DashboardInput: dashboardInputSchema,
  Problem: problemSchema,
};
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const response = (name) => ({
  description: name,
  content: { "application/json": { schema: ref(name) } },
});
const errors = Object.fromEntries(
  [400, 422, 429, 503].map((status) => [
    status,
    {
      description: "Problem Details",
      content: { "application/problem+json": { schema: ref("Problem") } },
    },
  ]),
);
const post = (input, output) => ({
  requestBody: {
    required: true,
    content: { "application/json": { schema: ref(input) } },
  },
  responses: { 200: response(output), ...errors },
});
const spec = {
  openapi: "3.1.0",
  info: {
    title: "Säävirta Energy Markets",
    version: "1.0.0",
    description:
      "Same-origin Cloudflare Worker API. Provider collection runs independently of browser requests. All intervals are UTC half-open intervals; display in Europe/Helsinki. POST bodies are limited to 512 bytes. Coordinates are not persisted. Live release requires verified provider contracts, NLS boundary data and price permission.",
  },
  paths: {
    "/api/v1/market-context": {
      post: post("PointInput", "MarketContextResponse"),
    },
    "/api/v1/markets/fi/dashboard": {
      post: post("DashboardInput", "Dashboard"),
      get: {
        description:
          "Publicly shareable coordinates only. Use POST for device coordinates. Start dates: Helsinki today minus seven days through today plus two days; the last requested day must not exceed today plus two days.",
        parameters: Object.entries(
          z.toJSONSchema(dashboardInputSchema).properties,
        ).map(([name, schema]) => ({
          name,
          in: "query",
          required: ["latitude", "longitude", "date"].includes(name),
          schema,
        })),
        responses: { 200: response("Dashboard"), ...errors },
      },
    },
    "/api/health": {
      get: { responses: { 200: { description: "Worker is running" } } },
    },
  },
  components: {
    schemas: Object.fromEntries(
      Object.entries(schemas).map(([name, schema]) => [
        name,
        z.toJSONSchema(schema, { unrepresentable: "any" }),
      ]),
    ),
  },
};
const target = new URL("../docs/markets/openapi.json", import.meta.url),
  output = `${JSON.stringify(spec, null, 2)}\n`;
if (process.argv.includes("--check")) {
  if ((await readFile(target, "utf8")) !== output)
    throw new Error(
      "OpenAPI is out of date: run node scripts/market-openapi.mjs",
    );
} else await writeFile(target, output);
