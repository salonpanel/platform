"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { GlassCard } from "./GlassCard";
import { GlassButton } from "./GlassButton";
import { LucideIcon } from "lucide-react";

interface GlassEmptyStateProps {
    icon?: LucideIcon;
    title: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
    secondaryActionLabel?: string;
    onSecondaryAction?: () => void;
    className?: string;
    variant?: "default" | "compact";
}

export function GlassEmptyState({
    icon: Icon,
    title,
    description,
    actionLabel,
    onAction,
    secondaryActionLabel,
    onSecondaryAction,
    className,
    variant = "default",
}: GlassEmptyStateProps) {
    const isCompact = variant === "compact";

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="w-full"
        >
            <GlassCard
                className={cn(
                    "flex flex-col items-center justify-center text-center",
                    isCompact ? "p-6" : "p-8 sm:p-12",
                    className
                )}
            >
                {Icon && (
                    <div className={cn(
                        "rounded-full bg-[rgba(79,161,216,0.10)] border border-[rgba(79,161,216,0.20)] flex items-center justify-center mb-4",
                        isCompact ? "w-12 h-12" : "w-16 h-16"
                    )}>
                        <Icon className={cn(
                            "text-[var(--bf-primary)]",
                            isCompact ? "w-6 h-6" : "w-8 h-8"
                        )} />
                    </div>
                )}

                <h3 className={cn(
                    "font-semibold text-[var(--bf-ink-50)] mb-2",
                    isCompact ? "text-base" : "text-lg sm:text-xl"
                )}>
                    {title}
                </h3>

                {description && (
                    <p className={cn(
                        "text-[var(--bf-ink-300)] max-w-sm mb-6",
                        isCompact ? "text-xs" : "text-sm"
                    )}>
                        {description}
                    </p>
                )}

                {(actionLabel || secondaryActionLabel) && (
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                        {onAction && actionLabel && (
                            <GlassButton
                                onClick={onAction}
                                variant="primary"
                                size={isCompact ? "sm" : "md"}
                                className="w-full sm:w-auto"
                            >
                                {actionLabel}
                            </GlassButton>
                        )}

                        {onSecondaryAction && secondaryActionLabel && (
                            <GlassButton
                                onClick={onSecondaryAction}
                                variant="ghost"
                                size={isCompact ? "sm" : "md"}
                                className="w-full sm:w-auto"
                            >
                                {secondaryActionLabel}
                            </GlassButton>
                        )}
                    </div>
                )}
            </GlassCard>
        </motion.div>
    );
}
