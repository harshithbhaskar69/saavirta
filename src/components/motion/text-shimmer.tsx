// Adapted from Motion Primitives (MIT), ibelick/motion-primitives,
// components/core/text-shimmer.tsx. The highlight sweep is a CSS animation:
// constant motion, linear, off the main thread. Reduced motion shows plain muted text.
import type { CSSProperties, ElementType } from "react";

export function TextShimmer({
  children,
  as: Component = "span",
  duration = 1.6,
  spread = 2,
}: {
  children: string;
  as?: ElementType;
  duration?: number;
  spread?: number;
}) {
  return (
    <Component
      className="text-shimmer"
      style={
        {
          "--shimmer-spread": `${children.length * spread}px`,
          "--shimmer-duration": `${duration}s`,
        } as CSSProperties
      }
    >
      {children}
    </Component>
  );
}
