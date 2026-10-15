import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { runtimeDependencyBoundary } from "./build-safety";

export default defineConfig({
  worker: { format: "es" },
  optimizeDeps: {
    include: [
      "react",
      "react-dom/client",
      "@tanstack/react-query",
      "motion/react",
      "@radix-ui/react-dialog",
      "@phosphor-icons/react",
      "recharts",
      "maplibre-gl",
    ],
  },
  plugins: [
    runtimeDependencyBoundary(),
    vinext(),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
