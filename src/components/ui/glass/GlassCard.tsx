import { cn } from "@/lib/utils";
import { HTMLMotionProps, motion } from "framer-motion";
import { ForwardedRef, forwardRef } from "react";

interface GlassCardProps extends HTMLMotionProps<"div"> {
    variant?: "default" | "clickable" | "hover-glow";
    noPadding?: boolean;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
    ({ className, variant = "default", noPadding = false, children, ...props }, ref) => {
        const baseStyles = "bg-[var(--bf-surface)] rounded-[var(--r-lg)] border border-[var(--bf-border)] overflow-hidden relative";

        const variants = {
            default: "",
            clickable: "cursor-pointer hover:border-[var(--bf-border-2)] hover:bg-[var(--bf-surface-2)] transition-all duration-200 active:scale-[0.99]",
            "hover-glow": "hover:border-[rgba(79,161,216,0.35)] hover:shadow-[var(--bf-shadow-glow)] transition-all duration-300",
        };

        return (
            <motion.div
                ref={ref}
                className={cn(
                    baseStyles,
                    variants[variant],
                    !noPadding && "p-4 sm:p-5",
                    className
                )}
                {...props}
            >
                {children}
            </motion.div>
        );
    }
);

GlassCard.displayName = "GlassCard";
