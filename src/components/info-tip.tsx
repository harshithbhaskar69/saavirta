"use client";
import { useId, type CSSProperties, type ReactNode } from "react";
import { InfoIcon } from "@phosphor-icons/react";

// Native Popover API: light dismiss, Escape and top-layer stacking without JavaScript.
// Anchored below its trigger where CSS anchor positioning exists; centred otherwise.
export function InfoTip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const id = useId();
  const anchor = {
    "--anchor": `--tip-${id.replace(/[^a-zA-Z0-9]/g, "")}`,
  } as CSSProperties;
  return (
    <>
      <button
        type="button"
        className="info-button"
        popoverTarget={id}
        aria-label={label}
        style={anchor}
      >
        <InfoIcon aria-hidden="true" />
      </button>
      <div id={id} popover="auto" className="info-popover" style={anchor}>
        {children}
      </div>
    </>
  );
}
