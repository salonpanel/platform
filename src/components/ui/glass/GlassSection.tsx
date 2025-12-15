import { cn } from "@/lib/utils";
import { GlassCard } from "./GlassCard";

interface GlassSectionProps {
    title: string;
    description?: string;
    action?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    containerClassName?: string;
}

export function GlassSection({
    title,
    description,
    action,
    children,
    className,
    containerClassName
}: GlassSectionProps) {
    return (
        <GlassCard className={cn("w-full", containerClassName)} noPadding>
            {/* Header */}
            <div className="flex items-start justify-between p-4 sm:p-5 border-b border-white/5">
                <div className="space-y-1">
                    <h3 className="text-base sm:text-lg font-semibold text-white tracking-tight leading-snug">
                        {title}
                    </h3>
                    {description && (
                        <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                            {description}
                        </p>
                    )}
                </div>
                {action && (
                    <div className="flex-shrink-0 ml-4">
                        {action}
                    </div>
                )}
            </div>

            {/* Content */}
            <div className={cn("p-4 sm:p-5", className)}>
                {children}
            </div>
        </GlassCard>
    );
}
