"use client";
// Adapted from Motion Primitives (MIT), ibelick/motion-primitives,
// components/core/animated-background.tsx with enableHover: one highlight glides
// to the panel under the pointer. The panels live in different parts of the tree,
// so they share the highlight through context rather than being direct children.
// The glide comes from the shared layoutId: it happens only while the previous
// highlight is still exiting, so a pointer that wanders off and returns later gets
// a fade instead of a flight across the page. Local adaptations: mouse only (touch
// taps fire hovers), and reduced motion fades in place.
import {
  createContext,
  useContext,
  useId,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

type Hover = {
  group: string;
  hovered: string | null;
  setHovered: (update: (id: string | null) => string | null) => void;
};
const HoverContext = createContext<Hover | null>(null);

export function HoverTiles({ children }: { children: ReactNode }) {
  const group = useId();
  const [hovered, setHovered] = useState<string | null>(null);
  return (
    <HoverContext.Provider value={{ group, hovered, setHovered }}>
      {children}
    </HoverContext.Provider>
  );
}

export function HoverTile({
  id,
  className,
  children,
}: {
  id: string;
  className: string;
  children: ReactNode;
}) {
  const hover = useContext(HoverContext)!;
  const reduce = useReducedMotion();
  const active = hover.hovered === id;
  return (
    <div
      className={className}
      data-hovered={active || undefined}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") hover.setHovered(() => id);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse")
          hover.setHovered((current) => (current === id ? null : current));
      }}
    >
      <AnimatePresence initial={false}>
        {active && (
          <motion.span
            aria-hidden="true"
            className="tile-highlight"
            layoutId={reduce ? undefined : hover.group}
            // Set inline so Motion corrects the radius while the highlight scales.
            style={{ borderRadius: 6 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.25 }}
          />
        )}
      </AnimatePresence>
      {children}
    </div>
  );
}
