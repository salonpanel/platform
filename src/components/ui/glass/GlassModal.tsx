"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { GlassCard } from "./GlassCard";
import { GlassButton } from "./GlassButton";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

interface GlassModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    description?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    size?: "sm" | "md" | "lg" | "xl" | "full";
    /**
     * If true, on mobile the modal behaves like a bottom-sheet (not fullscreen),
     * avoiding safe-area overlaps near the status bar / notch.
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
    mobileSheet = false,
    className,
}: GlassModalProps) {
    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [isOpen]);

    // Handle escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, [onClose]);

    const sizes = {
        sm: "max-w-sm",
        md: "max-w-md",
        lg: "max-w-lg",
        xl: "max-w-xl",
        full: "max-w-full m-4 h-[calc(100vh-2rem)]",
    };

    const mobileContainer = mobileSheet
        ? "w-full h-auto max-h-[85vh] mb-3 pointer-events-auto"
        : "w-full h-full md:h-auto pointer-events-auto";

    const mobileCard = mobileSheet
        ? "flex flex-col h-auto max-h-[85vh]"
        : "flex flex-col h-full md:max-h-[85vh]";

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Modal Container */}
                    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 pointer-events-none">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ duration: 0.2 }}
                            className={cn(
                                mobileContainer,
                                sizes[size],
                                "md:rounded-xl rounded-t-xl overflow-hidden"
                            )}
                        >
                            <GlassCard
                                className={cn(mobileCard, className)}
                                noPadding
                            >
                                {/* Header */}
                                {(title || description) && (
                                    <div className="flex items-center justify-between p-5 border-b border-[var(--bf-border)]">
                                        <div>
                                            {title && <h2 className="text-lg font-semibold text-[var(--bf-ink-50)]" style={{ fontFamily: "var(--font-sans)" }}>{title}</h2>}
                                            {description && <p className="text-sm text-[var(--bf-ink-300)] mt-0.5" style={{ fontFamily: "var(--font-sans)" }}>{description}</p>}
                                        </div>
                                        <GlassButton
                                            variant="ghost"
                                            size="sm"
                                            onClick={onClose}
                                            className="h-9 w-9 p-0 ml-3 rounded-full hover:bg-white/10"
                                        >
                                            <X className="w-5 h-5" />
                                        </GlassButton>
                                    </div>
                                )}

                                {/* Body */}
                                <div className="p-5 overflow-y-auto custom-scrollbar">
                                    {children}
                                </div>

                                {/* Footer */}
                                {footer && (
                                    <div
                                        className={cn(
                                            "px-5 border-t border-[var(--bf-border)]",
                                            mobileSheet ? "pt-4 pb-4 safe-area-pb" : "pt-5 pb-modal-footer"
                                        )}
                                    >
                                        {footer}
                                    </div>
                                )}
                            </GlassCard>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
