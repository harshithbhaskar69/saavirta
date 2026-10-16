import type { Plugin } from "vite";

const buildOnly =
  /(?:^|[/\\]node_modules[/\\])(braces|micromatch|fast-glob|vite-plugin-commonjs|vite-plugin-dynamic-import)(?:[/\\]|$)/;

export function unsafeRuntimeModules(ids: string[]): string[] {
  return ids.filter(
    (id) => buildOnly.test(id) || /[/\\]tooling[/\\]build-glob[/\\]/.test(id),
  );
}

// Build tooling must never enter a browser or Worker runtime bundle.
export function runtimeDependencyBoundary(): Plugin {
  return {
    name: "saavirta-runtime-dependency-boundary",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      const ids = Object.values(bundle).flatMap((output) =>
        output.type === "chunk"
          ? [
              ...Object.keys(output.modules),
              ...output.imports,
              ...output.dynamicImports,
            ]
          : [],
      );
      const unsafe = unsafeRuntimeModules(ids);
      if (unsafe.length)
        this.error(
          `Build-only dependency entered runtime: ${unsafe.join(", ")}`,
        );
      this.emitFile({
        type: "asset",
        fileName: "runtime-dependency-check.json",
        source: JSON.stringify({
          checkedModuleReferences: ids.length,
          unsafeModules: unsafe,
        }),
      });
    },
  };
}
