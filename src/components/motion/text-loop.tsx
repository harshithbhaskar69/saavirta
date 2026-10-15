"use client";
// Adapted from Motion Primitives (MIT), components/core/text-loop.tsx.
// Reserve the widest item, and present all labels statically for reduced motion.
import { Fragment, useEffect, useRef, type ReactNode } from "react";
import { useInView } from "motion/react";
import { useReducedMotion } from "./use-reduced-motion";
import { TextRoll } from "./text-roll";

export function TextLoop({
  children: items,
  index,
  onAdvance,
}: {
  children: readonly { label: string; icon: ReactNode }[];
  index: number;
  onAdvance: () => void;
}) {
  const root = useRef<HTMLSpanElement>(null);
  const visible = useInView(root);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce || !visible || items.length < 2) return;
    const timer = setInterval(() => {
      if (!document.hidden) onAdvance();
    }, 3200);
    return () => clearInterval(timer);
  }, [items.length, onAdvance, reduce, visible]);
  return (
    <span ref={root} className="text-loop" aria-hidden="true">
      {reduce ? (
        <span className="text-loop-static">
          {items.map(({ label, icon }, i) => (
            <Fragment key={label}>
              {i > 0 && ", "}
              <span>
                {label}
                <span className="metric-icon">{icon}</span>
              </span>
            </Fragment>
          ))}
        </span>
      ) : (
        <>
          <span className="text-loop-size">
            {items.map(({ label, icon }) => (
              <span key={label}>
                {label}
                <span className="metric-icon">{icon}</span>
              </span>
            ))}
          </span>
          <span className="text-loop-item">
            <TextRoll key={index} icon={items[index].icon}>
              {items[index].label}
            </TextRoll>
          </span>
        </>
      )}
    </span>
  );
}
