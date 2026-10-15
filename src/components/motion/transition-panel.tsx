"use client";
// Adapted from Motion Primitives (MIT), components/core/transition-panel.tsx.
// Small, short transitions keep repeated analyst actions quiet; reduced motion is immediate.
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
export function TransitionPanel({
  children,
  activeKey,
  inline = false,
}: {
  children: ReactNode;
  activeKey: string;
  inline?: boolean;
}) {
  const reduce = useReducedMotion();
  const Panel = inline ? motion.span : motion.div;
  return (
    <AnimatePresence initial={false} mode="wait">
      <Panel
        key={activeKey}
        style={
          inline ? { display: "inline-flex", alignItems: "center" } : undefined
        }
        initial={reduce ? false : { opacity: 0, y: inline ? 4 : 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: -3 }}
        transition={{ duration: reduce ? 0 : 0.16, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </Panel>
    </AnimatePresence>
  );
}
