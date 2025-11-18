"use client";

import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "neutral";

const toneStyles: Record<Tone, string> = {
  success:
    "text-emerald-200 bg-emerald-500/10 border border-emerald-400/20",
  warning:
    "text-amber-200 bg-amber-500/10 border border-amber-400/20",
  neutral:
    "text-slate-200 bg-white/5 border border-white/10",
};

type ServiceStatusBadgeProps = {
  label: string;
  tone?: Tone;
  className?: string;
};

export function ServiceStatusBadge({
  label,
  tone = "neutral",
  className,
}: ServiceStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur-sm",
        toneStyles[tone],
        className
      )}
    >
      {label}
    </span>
  );
}

