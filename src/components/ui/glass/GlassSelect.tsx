import { cn } from "@/lib/utils";
import { SelectHTMLAttributes, forwardRef } from "react";

interface GlassSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    error?: boolean;
    label?: string;
    helperText?: string;
}

export const GlassSelect = forwardRef<HTMLSelectElement, GlassSelectProps>(
    ({ className, error, label, helperText, id, children, ...props }, ref) => {
        return (
            <div className="w-full space-y-1.5">
                {label && (
                    <label
                        htmlFor={id}
                        className="block text-xs sm:text-sm font-medium text-[var(--text-secondary)] ml-0.5"
                    >
                        {label}
                    </label>
                )}

                <div className="relative">
                    <select
                        ref={ref}
                        id={id}
                        className={cn(
                            "w-full appearance-none rounded-lg glass border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white transition-all duration-200",
                            "focus:border-emerald-500/50 focus:bg-white/[0.05] focus:outline-none focus:ring-1 focus:ring-emerald-500/50",
                            "disabled:opacity-50 disabled:cursor-not-allowed",
                            error && "border-red-500/50 focus:border-red-500 focus:ring-red-500/30",
                            className
                        )}
                        {...props}
                    >
                        {children}
                    </select>
                    {/* Custom arrow indicator */}
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-white/50">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>

                {helperText && (
                    <p className={cn(
                        "text-[10px] sm:text-xs ml-0.5",
                        error ? "text-red-400" : "text-[var(--text-secondary)]"
                    )}>
                        {helperText}
                    </p>
                )}
            </div>
        );
    }
);

GlassSelect.displayName = "GlassSelect";
