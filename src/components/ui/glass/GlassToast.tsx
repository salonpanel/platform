"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type GlassToastTone = "success" | "warning" | "danger" | "info" | "neutral";

interface GlassToastProps {
    message: string;
    tone?: GlassToastTone;
    icon?: React.ReactNode;
    onClose?: () => void;
    duration?: number;
}

export const GlassToast: React.FC<GlassToastProps> = ({
    message,
    tone = "info",
    icon,
    onClose,
    duration = 4000,
}) => {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        if (duration > 0) {
            const timer = setTimeout(() => {
                setIsVisible(false);
                setTimeout(onClose || (() => { }), 300);
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [duration, onClose]);

    const toneStyles: Record<GlassToastTone, string> = {
        success: "bg-[rgba(30,161,159,0.12)] border-[rgba(30,161,159,0.35)] text-[var(--bf-teal-100)]",
        warning: "bg-[rgba(232,176,74,0.10)] border-[rgba(232,176,74,0.30)] text-[#F2C87A]",
        danger:  "bg-[rgba(224,96,114,0.12)] border-[rgba(224,96,114,0.35)] text-[#F2A0AC]",
        info:    "bg-[rgba(79,161,216,0.12)] border-[rgba(79,161,216,0.35)] text-[var(--bf-cyan-100)]",
        neutral: "bg-[var(--bf-surface)] border-[var(--bf-border)] text-[var(--bf-ink-50)]",
    };

    const defaultIcons: Record<GlassToastTone, React.ReactNode> = {
        success: <CheckCircle className="w-5 h-5 text-[var(--bf-success)]" />,
        warning: <AlertTriangle className="w-5 h-5 text-[var(--bf-warn)]" />,
        danger:  <AlertCircle className="w-5 h-5 text-[var(--bf-danger)]" />,
        info:    <Info className="w-5 h-5 text-[var(--bf-primary)]" />,
        neutral: <Info className="w-5 h-5 text-[var(--bf-ink-300)]" />,
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className={cn(
                        "fixed top-4 right-4 z-[100] max-w-sm w-full rounded-[var(--r-xl)] border shadow-[var(--bf-shadow-card)] p-4 flex items-start gap-3",
                        "bg-[var(--bf-surface)]",
                        toneStyles[tone]
                    )}
                >
                    <div className="flex-shrink-0 mt-0.5">
                        {icon || defaultIcons[tone]}
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                        <p className="text-sm font-medium leading-5" style={{ fontFamily: "var(--font-sans)" }}>{message}</p>
                    </div>
                    {onClose && (
                        <button
                            onClick={() => {
                                setIsVisible(false);
                                setTimeout(onClose, 300);
                            }}
                            className="flex-shrink-0 p-1 rounded-[var(--r-sm)] hover:bg-[rgba(255,255,255,0.06)] transition-colors text-[var(--bf-ink-400)] hover:text-[var(--bf-ink-50)]"
                            aria-label="Cerrar notificación"
                        >
                            <X size={14} />
                        </button>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
};
