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
        default: "bg-white/10 text-white border-white/10",
        success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        danger: "bg-red-500/10 text-red-400 border-red-500/20",
        info: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        neutral: "bg-slate-500/10 text-slate-400 border-slate-500/20",
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
