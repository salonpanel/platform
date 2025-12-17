import { cn } from "@/lib/utils";
import { HTMLMotionProps, motion } from "framer-motion";
import { ForwardedRef, forwardRef } from "react";

interface GlassCardProps extends HTMLMotionProps<"div"> {
    variant?: "default" | "clickable" | "hover-glow";
    noPadding?: boolean;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
    ({ className, variant = "default", noPadding = false, children, ...props }, ref) => {
        const baseStyles = "glass rounded-xl border border-white/10 overflow-hidden relative";

        const variants = {
            default: "",
            clickable: "cursor-pointer hover:border-white/20 hover:bg-white/[0.04] transition-all duration-200 active:scale-[0.99]",
            "hover-glow": "hover:border-emerald-500/30 hover:shadow-[0_0_20px_rgba(16,185,129,0.1)] transition-all duration-300",
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
