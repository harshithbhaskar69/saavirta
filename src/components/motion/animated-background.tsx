"use client";
// Adapted from Motion Primitives (MIT), ibelick/motion-primitives,
// components/core/animated-background.tsx. Controlled selection, preserved handlers,
// semantic span wrappers and reduced motion are local accessibility adaptations.
import {
  Children,
  cloneElement,
  useId,
  type ReactElement,
  type ReactNode,
} from "react";
import { motion, useReducedMotion } from "motion/react";

// Keyboard-initiated changes (shortcuts, Enter/Space) snap: motion on repeated
// keyboard actions reads as lag. Pointer input restores the spring.
let keyboardInput = false;
if (typeof window !== "undefined") {
  window.addEventListener("keydown", () => (keyboardInput = true), true);
  window.addEventListener("pointerdown", () => (keyboardInput = false), true);
}

type Item = ReactElement<{
  "data-id": string;
  className?: string;
  children?: ReactNode;
}>;
export function AnimatedBackground({
  children,
  value,
}: {
  children: Item[];
  value: string;
}) {
  const id = useId(),
    reduce = useReducedMotion();
  return Children.map(children, (child) =>
    cloneElement(
      child,
      {
        className: `motion-choice ${child.props.className ?? ""}`,
      },
      <>
        {value === child.props["data-id"] && (
          <motion.span
            aria-hidden="true"
            className="selection-fill"
            layoutId={reduce || keyboardInput ? undefined : id}
            initial={false}
            transition={{ type: "spring", stiffness: 430, damping: 38 }}
          />
        )}
        <span className="choice-label">{child.props.children}</span>
      </>,
    ),
  );
}
