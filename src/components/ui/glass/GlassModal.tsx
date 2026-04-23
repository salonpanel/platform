"use client";

import { X } from "lucide-react";
import { GlassCard } from "./GlassCard";
import { GlassButton } from "./GlassButton";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { SheetModalFrame } from "@/components/ui/sheet-modal-frame";

interface GlassModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    description?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    size?: "sm" | "md" | "lg" | "xl" | "full";
    /**
     * @deprecated Todas las instancias usan hoja inferior; se mantiene por compatibilidad.
     */
    mobileSheet?: boolean;
    className?: string;
}

export function GlassModal({
    isOpen,
    onClose,
    title,
    description,
    children,
    footer,
    size = "md",
    className,
}: GlassModalProps) {
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, [onClose]);

    const frameSize =
        size === "full" ? "xl" : (size as "sm" | "md" | "lg" | "xl");

    const sheetClassName =
        size === "full"
            ? "md:max-w-[min(96rem,calc(100vw-1.5rem))]"
            : undefined;

    return (
        <SheetModalFrame
            isOpen={isOpen}
            onClose={onClose}
            onBackdropClick={onClose}
            size={frameSize}
            sheetClassName={sheetClassName}
        >
            <GlassCard
                className={cn(
                    "flex min-h-0 flex-1 flex-col border-0 bg-transparent shadow-none",
                    className
                )}
                noPadding
            >
                {(title || description) && (
                    <div className="flex items-center justify-between border-b border-[var(--bf-border)] p-5">
                        <div>
                            {title && (
                                <h2
                                    className="text-lg font-semibold text-[var(--bf-ink-50)]"
                                    style={{ fontFamily: "var(--font-sans)" }}
                                >
                                    {title}
                                </h2>
                            )}
                            {description && (
                                <p
                                    className="mt-0.5 text-sm text-[var(--bf-ink-300)]"
                                    style={{ fontFamily: "var(--font-sans)" }}
                                >
                                    {description}
                                </p>
                            )}
                        </div>
                        <GlassButton
                            variant="ghost"
                            size="sm"
                            onClick={onClose}
                            className="ml-3 h-9 w-9 shrink-0 rounded-full p-0 hover:bg-white/10"
                        >
                            <X className="h-5 w-5" />
                        </GlassButton>
                    </div>
                )}

                <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-5">
                    {children}
                </div>

                {footer && (
                    <div
                        className={cn(
                            "border-t border-[var(--bf-border)] px-5",
                            "pt-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
                        )}
                    >
                        {footer}
                    </div>
                )}
            </GlassCard>
        </SheetModalFrame>
    );
}
