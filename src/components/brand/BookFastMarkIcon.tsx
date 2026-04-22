import { cn } from "@/lib/utils";

/**
 * Isotipo BookFast (tres rayas, Brand Kit #bf-mark) para UI en color único.
 * Usar con `className="text-[var(--bf-ink)]"` (o similar) sobre fondos marca.
 */
export function BookFastMarkIcon({
  size = 20,
  className,
  "aria-hidden": ariaHidden = true,
}: {
  size?: number;
  className?: string;
  "aria-hidden"?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={cn("shrink-0", className)}
      aria-hidden={ariaHidden}
      focusable={false}
    >
      <g className="fill-current">
        <g transform="rotate(-6 20 11)">
          <path d="M 3 8.5 Q 3 6.5 5.5 6.5 L 33 6.5 Q 37 6.5 37 11 Q 37 15.5 33 15.5 L 5.5 15.5 Q 3 15.5 3 13.5 Z" />
        </g>
        <g transform="rotate(-4 20 22)">
          <path d="M 4 18.5 Q 4 16.5 7 16.5 L 32 16.5 Q 35 16.5 35 20.5 Q 35 25 30 25 L 7 25 Q 4 25 4 23 Z" />
        </g>
        <g transform="rotate(-3 20 31)">
          <path d="M 10 28.5 Q 10 26.5 13 26.5 L 27 26.5 Q 30 26.5 30 30.5 Q 30 34.5 27 34.5 L 13 34.5 Q 10 34.5 10 32.5 Z" />
        </g>
      </g>
    </svg>
  );
}
