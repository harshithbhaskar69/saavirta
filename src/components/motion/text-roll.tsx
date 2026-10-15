"use client";
// Adapted from Motion Primitives (MIT), components/core/text-roll.tsx.
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "./use-reduced-motion";

export function TextRoll({
  children,
  className,
  icon,
}: {
  children: string;
  className?: string;
  icon: ReactNode;
}) {
  const reduce = useReducedMotion();
  const letters = Array.from(children, (letter) =>
    letter === " " ? "\u00a0" : letter,
  );
  const glyphs = [
    ...letters,
    <span className="metric-icon" key="icon">
      {icon}
    </span>,
  ];
  return (
    <span className={cn("text-roll", className)}>
      {reduce ? (
        <>
          {children}
          <span className="metric-icon">{icon}</span>
        </>
      ) : (
        <>
          {glyphs.map((glyph, i) => (
            <span
              className={cn(
                "text-roll-letter",
                i === letters.length && "text-roll-icon",
              )}
              aria-hidden="true"
              key={i}
            >
              {i < letters.length && (
                <motion.span
                  className="text-roll-out"
                  initial={{ rotateX: 0 }}
                  animate={{ rotateX: 90 }}
                  transition={{
                    duration: 0.4,
                    delay: i * 0.035,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  {glyph}
                </motion.span>
              )}
              <motion.span
                className="text-roll-in"
                initial={{ rotateX: 90 }}
                animate={{ rotateX: 0 }}
                transition={{
                  duration: 0.4,
                  delay: i * 0.035 + 0.12,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                {glyph}
              </motion.span>
              <span className="text-roll-size">{glyph}</span>
            </span>
          ))}
          <span className="sr-only">{children}</span>
        </>
      )}
    </span>
  );
}
