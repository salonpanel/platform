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
                        className="block text-xs sm:text-sm font-medium text-[var(--text-secondary)] ml-0.5"
                    >
                        {label}
                    </label>
                )}

                <div className="relative">
                    {leftIcon && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none">
                            {leftIcon}
                        </div>
                    )}
                    <input
                        ref={ref}
                        id={id}
                        className={cn(
                            "w-full rounded-lg glass border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/20 transition-all duration-200",
                            "focus:border-emerald-500/50 focus:bg-white/[0.05] focus:outline-none focus:ring-1 focus:ring-emerald-500/50",
                            "disabled:opacity-50 disabled:cursor-not-allowed",
                            error && "border-red-500/50 focus:border-red-500 focus:ring-red-500/30",
                            leftIcon && "pl-9",
                            className
                        )}
                        {...props}
                    />
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

GlassInput.displayName = "GlassInput";
