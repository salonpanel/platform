import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef } from "react";

interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> {
    error?: boolean;
    label?: string;
    helperText?: string;
    leftIcon?: React.ReactNode;
}

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
    ({ className, error, label, helperText, id, leftIcon, ...props }, ref) => {
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
                    {leftIcon && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--bf-ink-400)] pointer-events-none">
                            {leftIcon}
                        </div>
                    )}
                    <input
                        ref={ref}
                        id={id}
                        className={cn(
                            "w-full rounded-[var(--r-md)] border bg-[var(--bf-bg-elev)] border-[var(--bf-border-2)] px-3 py-2 text-sm text-[var(--bf-ink-50)] placeholder:text-[var(--bf-ink-400)] transition-all duration-200",
                            "focus:border-[var(--bf-primary)] focus:outline-none focus:ring-2 focus:ring-[rgba(79,161,216,0.15)]",
                            "disabled:opacity-50 disabled:cursor-not-allowed",
                            error && "border-[rgba(224,96,114,0.4)] focus:border-[var(--bf-danger)] focus:ring-[rgba(224,96,114,0.2)]",
                            leftIcon && "pl-9",
                            className
                        )}
                        {...props}
                    />
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

GlassInput.displayName = "GlassInput";
