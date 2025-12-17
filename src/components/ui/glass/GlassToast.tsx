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
        success: "bg-emerald-500/10 border-emerald-500/20 text-emerald-100",
        warning: "bg-amber-500/10 border-amber-500/20 text-amber-100",
        danger: "bg-red-500/10 border-red-500/20 text-red-100",
        info: "bg-blue-500/10 border-blue-500/20 text-blue-100",
        neutral: "bg-white/10 border-white/10 text-white",
    };

    const defaultIcons: Record<GlassToastTone, React.ReactNode> = {
        success: <CheckCircle className="w-5 h-5 text-emerald-400" />,
        warning: <AlertTriangle className="w-5 h-5 text-amber-400" />,
        danger: <AlertCircle className="w-5 h-5 text-red-400" />,
        info: <Info className="w-5 h-5 text-blue-400" />,
        neutral: <Info className="w-5 h-5 text-white/70" />,
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
                        "fixed top-4 right-4 z-[100] max-w-sm w-full rounded-2xl border backdrop-blur-xl shadow-[0_18px_45px_rgba(0,0,0,0.6)] p-4 flex items-start gap-3",
                        toneStyles[tone]
                    )}
                >
                    <div className="flex-shrink-0 mt-0.5">
                        {icon || defaultIcons[tone]}
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                        <p className="text-sm font-medium leading-5">{message}</p>
                    </div>
                    {onClose && (
                        <button
                            onClick={() => {
                                setIsVisible(false);
                                setTimeout(onClose, 300);
                            }}
                            className="flex-shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors text-white/50 hover:text-white"
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
