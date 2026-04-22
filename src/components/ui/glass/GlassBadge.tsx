import { cn } from "@/lib/utils";

interface GlassBadgeProps {
    children: React.ReactNode;
    variant?: "default" | "success" | "warning" | "danger" | "info" | "neutral";
    className?: string;
    size?: "xs" | "sm" | "md";
}

export function GlassBadge({
    children,
    variant = "default",
    className,
    size = "md"
}: GlassBadgeProps) {
    const variants = {
        default:  "bg-[var(--bf-bg-elev)] text-[var(--bf-ink-200)] border-[var(--bf-border)]",
        success:  "bg-[rgba(30,161,159,0.12)] text-[var(--bf-teal-200)] border-[rgba(30,161,159,0.35)]",
        warning:  "bg-[rgba(232,176,74,0.10)] text-[#F2C87A] border-[rgba(232,176,74,0.30)]",
        danger:   "bg-[rgba(224,96,114,0.10)] text-[#F2A0AC] border-[rgba(224,96,114,0.30)]",
        info:     "bg-[rgba(79,161,216,0.12)] text-[var(--bf-cyan-200)] border-[rgba(79,161,216,0.35)]",
        neutral:  "bg-[var(--bf-bg-elev)] text-[var(--bf-ink-300)] border-[var(--bf-border)]",
    };

    const sizes = {
        xs: "px-1.5 py-0.5 text-[9px]",
        sm: "px-2 py-0.5 text-[10px]",
        md: "px-2.5 py-1 text-xs",
    };

    return (
        <span
            className={cn(
                "inline-flex items-center justify-center font-medium tracking-wide first-letter:uppercase rounded-full border backdrop-blur-md",
                variants[variant],
                sizes[size],
                className
            )}
        >
            {children}
        </span>
    );
}
