"use client";

import { useId, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";

const BARS = [
  {
    rot: "rotate(-6 20 11)",
    d: "M 3 8.5 Q 3 6.5 5.5 6.5 L 33 6.5 Q 37 6.5 37 11 Q 37 15.5 33 15.5 L 5.5 15.5 Q 3 15.5 3 13.5 Z",
    delay: 0,
  },
  {
    rot: "rotate(-4 20 22)",
    d: "M 4 18.5 Q 4 16.5 7 16.5 L 32 16.5 Q 35 16.5 35 20.5 Q 35 25 30 25 L 7 25 Q 4 25 4 23 Z",
    delay: 0.14,
  },
  {
    rot: "rotate(-3 20 31)",
    d: "M 10 28.5 Q 10 26.5 13 26.5 L 27 26.5 Q 30 26.5 30 30.5 Q 30 34.5 27 34.5 L 13 34.5 Q 10 34.5 10 32.5 Z",
    delay: 0.28,
  },
] as const;

export type BookFastMarkIntensity = "normal" | "subtle";

type BookFastMarkAnimatedProps = {
  size?: number;
  className?: string;
  /** `subtle`: más lento y discreto (p. ej. skeleton del panel). */
  intensity?: BookFastMarkIntensity;
  /** Halo cyan animado alrededor del isotipo. */
  glow?: boolean;
  /** Si el isotipo es solo decorativo (p. ej. barra del skeleton). */
  decorative?: boolean;
};

export function BookFastMarkAnimated({
  size = 96,
  className = "",
  intensity = "normal",
  glow = true,
  decorative = false,
}: BookFastMarkAnimatedProps) {
  const rawId = useId();
  const gradId = useMemo(
    () => `bf-grad-${rawId.replace(/:/g, "")}`,
    [rawId],
  );
  const reduceMotion = useReducedMotion();

  const subtle = intensity === "subtle";
  const barDuration = subtle ? 1.55 : 1.05;
  const yAmp = subtle ? -1.15 : -2.85;
  const opRange = subtle ? [0.48, 0.88, 0.48] : [0.58, 1, 0.58];
  const breatheScale = subtle ? [1, 1.012, 1] : [1, 1.038, 1];
  const breatheDur = subtle ? 2.8 : 2.2;

  if (reduceMotion) {
    return (
      <img
        src="/bookfast-mark.svg"
        alt={decorative ? "" : "BookFast"}
        width={size}
        height={size}
        className={className}
        decoding="async"
        aria-hidden={decorative ? true : undefined}
      />
    );
  }

  const svg = (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={`overflow-visible ${className}`}
      initial={false}
      animate={{ scale: breatheScale }}
      transition={{
        repeat: Infinity,
        duration: breatheDur,
        ease: "easeInOut",
      }}
      style={{ transformOrigin: "20px 20px" }}
      aria-hidden={decorative ? true : undefined}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "BookFast"}
    >
      <defs>
        <linearGradient id={gradId} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#6FB8E4" />
          <stop offset="55%" stopColor="#4FA1D8" />
          <stop offset="100%" stopColor="#1F6B9E" />
        </linearGradient>
      </defs>
      {BARS.map((bar, i) => (
        <g key={i} transform={bar.rot} fill={`url(#${gradId})`}>
          <motion.g
            animate={{
              y: [0, yAmp, 0],
              opacity: opRange,
            }}
            transition={{
              repeat: Infinity,
              duration: barDuration,
              delay: bar.delay,
              ease: [0.45, 0.08, 0.55, 0.92],
            }}
          >
            <path d={bar.d} />
          </motion.g>
        </g>
      ))}
    </motion.svg>
  );

  if (!glow) {
    return svg;
  }

  return (
    <div
      className={
        subtle
          ? "bf-mark-loader-glow bf-mark-loader-glow--subtle inline-flex"
          : "bf-mark-loader-glow inline-flex"
      }
    >
      {svg}
    </div>
  );
}
