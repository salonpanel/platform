import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "danger" | "ghost";
    size?: "sm" | "md" | "lg" | "icon";
    isLoading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
    ({ className, variant = "secondary", size = "md", isLoading, leftIcon, rightIcon, children, disabled, ...props }, ref) => {

        const baseStyles = "inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-white/20 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100";

        const variants = {
            primary:   "bg-[var(--bf-primary)] text-[var(--bf-ink)] border border-transparent hover:bg-[var(--bf-cyan-300)] focus:ring-[rgba(79,161,216,0.3)]",
            secondary: "bg-[var(--bf-bg-elev)] text-[var(--bf-ink-100)] border border-[var(--bf-border-2)] hover:border-[var(--bf-cyan-600)] hover:text-[var(--bf-primary)] focus:ring-[rgba(79,161,216,0.2)]",
            danger:    "bg-[rgba(224,96,114,0.10)] text-[var(--bf-danger)] border border-[rgba(224,96,114,0.30)] hover:bg-[rgba(224,96,114,0.18)] focus:ring-[rgba(224,96,114,0.25)]",
            ghost:     "bg-transparent text-[var(--bf-ink-400)] hover:text-[var(--bf-ink-50)] hover:bg-[var(--bf-bg-elev)] border border-transparent",
        };

        const sizes = {
            sm:   "h-7 px-2.5 text-xs rounded-[var(--r-md)] gap-1.5",
            md:   "h-9 px-4 text-sm rounded-[var(--r-md)] gap-2",
            lg:   "h-11 px-6 text-base rounded-[var(--r-lg)] gap-2.5",
            icon: "h-9 w-9 p-0 rounded-[var(--r-md)] justify-center",
        };

        return (
            <button
                ref={ref}
                className={cn(baseStyles, variants[variant], sizes[size], className)}
                disabled={disabled || isLoading}
                {...props}
            >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {!isLoading && leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
                {children}
                {!isLoading && rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
            </button>
        );
    }
);

GlassButton.displayName = "GlassButton";
