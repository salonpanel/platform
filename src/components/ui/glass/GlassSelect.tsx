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
                        className="block text-xs sm:text-sm font-medium text-[var(--bf-ink-300)] ml-0.5"
                    style={{ fontFamily: "var(--font-sans)" }}
                    >
                        {label}
                    </label>
                )}

                <div className="relative">
                    <select
                        ref={ref}
                        id={id}
                        className={cn(
                            "w-full appearance-none rounded-[var(--r-md)] border bg-[var(--bf-bg-elev)] border-[var(--bf-border-2)] px-3 py-2 text-sm text-[var(--bf-ink-50)] transition-all duration-200",
                            "focus:border-[var(--bf-primary)] focus:outline-none focus:ring-2 focus:ring-[rgba(79,161,216,0.15)]",
                            "disabled:opacity-50 disabled:cursor-not-allowed",
                            error && "border-[rgba(224,96,114,0.4)] focus:border-[var(--bf-danger)] focus:ring-[rgba(224,96,114,0.2)]",
                            className
                        )}
                        {...props}
                    >
                        {children}
                    </select>
                    {/* Custom arrow indicator */}
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[var(--bf-ink-400)]">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>

                {helperText && (
                    <p className={cn(
                        "text-[10px] sm:text-xs ml-0.5",
                        error ? "text-[var(--bf-danger)]" : "text-[var(--bf-ink-400)]"
                    )}>
                        {helperText}
                    </p>
                )}
            </div>
        );
    }
);

GlassSelect.displayName = "GlassSelect";
