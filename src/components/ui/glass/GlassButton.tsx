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
            primary: "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 focus:ring-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.1)] hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]",
            secondary: "bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/20 focus:ring-white/30",
            danger: "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 focus:ring-red-500/50 hover:shadow-[0_0_15px_rgba(239,68,68,0.15)]",
            ghost: "bg-transparent hover:bg-white/5 text-[var(--text-secondary)] hover:text-white border border-transparent",
        };

        const sizes = {
            sm: "h-7 px-2.5 text-xs rounded-lg gap-1.5",
            md: "h-9 px-4 text-sm rounded-lg gap-2",
            lg: "h-11 px-6 text-base rounded-xl gap-2.5",
            icon: "h-9 w-9 p-0 rounded-lg justify-center",
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
