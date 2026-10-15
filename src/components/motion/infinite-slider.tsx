"use client";
// Adapted from Motion Primitives (MIT), components/core/infinite-slider.tsx.
// Native measurement and playback speed avoid a dependency and hover restarts.
import {
  Children,
  cloneElement,
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { animate, useInView } from "motion/react";
import { useReducedMotion } from "./use-reduced-motion";

export function InfiniteSlider({
  children,
  speed = 36,
  speedOnHover = 12,
}: {
  children: ReactElement<{ tabIndex?: number }>[];
  speed?: number;
  speedOnHover?: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const group = useRef<HTMLDivElement>(null);
  const playback = useRef<ReturnType<typeof animate> | null>(null);
  const [width, setWidth] = useState(0);
  const [focused, setFocused] = useState(false);
  const reduce = useReducedMotion();
  const visible = useInView(root);
  useEffect(() => {
    const element = group.current!;
    const observer = new ResizeObserver(() =>
      setWidth(element.getBoundingClientRect().width),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const element = track.current!;
    if (reduce || focused || !width) {
      element.style.transform = "none";
      return;
    }
    const controls = animate(
      element,
      {
        transform: ["translateX(0px)", `translateX(-${width}px)`],
      },
      { duration: width / speed, ease: "linear", repeat: Infinity },
    );
    controls.pause();
    if (matchMedia("(hover: hover)").matches && root.current!.matches(":hover"))
      controls.speed = speedOnHover / speed;
    playback.current = controls;
    return () => {
      controls.cancel();
      playback.current = null;
    };
  }, [width, speed, speedOnHover, reduce, focused]);
  useEffect(() => {
    const sync = () => {
      if (visible && !document.hidden) playback.current?.play();
      else playback.current?.pause();
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, [visible, width, speed, speedOnHover, reduce, focused]);
  return (
    <div
      ref={root}
      className="infinite-slider"
      data-static={reduce || focused || undefined}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse" && playback.current)
          playback.current.speed = speedOnHover / speed;
      }}
      onPointerLeave={() => {
        if (playback.current) playback.current.speed = 1;
      }}
      onFocusCapture={(event) => {
        if ((event.target as HTMLElement).matches(":focus-visible"))
          setFocused(true);
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
    >
      <div ref={track} className="infinite-slider-track">
        <div ref={group} className="infinite-slider-group">
          {children}
        </div>
        <div
          className="infinite-slider-group infinite-slider-copy"
          aria-hidden="true"
        >
          {Children.map(children, (child) =>
            cloneElement(child, { tabIndex: -1 }),
          )}
        </div>
      </div>
    </div>
  );
}
