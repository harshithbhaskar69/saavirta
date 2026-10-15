"use client";
// Adapted from Motion Primitives (MIT), components/core/disclosure.tsx.
import {
  cloneElement,
  createContext,
  useContext,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { useReducedMotion } from "./use-reduced-motion";

const DisclosureContext = createContext<{
  open: boolean;
  toggle: () => void;
  id: string;
} | null>(null);

function useDisclosure() {
  const context = useContext(DisclosureContext);
  if (!context) throw new Error("Disclosure parts require a Disclosure parent");
  return context;
}

export function Disclosure({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <DisclosureContext.Provider
      value={{ open, toggle: () => setOpen((value) => !value), id }}
    >
      <div className={className}>{children}</div>
    </DisclosureContext.Provider>
  );
}

export function DisclosureTrigger({
  children,
}: {
  children: ReactElement<ButtonHTMLAttributes<HTMLButtonElement>>;
}) {
  const { open, toggle, id } = useDisclosure();
  return cloneElement(children, {
    type: "button",
    "aria-expanded": open,
    "aria-controls": id,
    onClick: (event) => {
      children.props.onClick?.(event);
      if (!event.defaultPrevented) toggle();
    },
  });
}

export function DisclosureContent({ children }: { children: ReactNode }) {
  const { open, id } = useDisclosure();
  const reduce = useReducedMotion();
  return (
    <div
      id={id}
      aria-hidden={!open}
      inert={!open}
      style={{ overflow: "hidden" }}
    >
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              duration: reduce ? 0 : 0.18,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
