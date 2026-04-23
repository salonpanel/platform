"use client";

import { motion } from "framer-motion";
import { BookFastMarkAnimated } from "@/components/brand/BookFastMarkAnimated";
import { DashboardSkeleton } from "./DashboardSkeleton";
import { BF_PAGE_TRANSITION } from "@/lib/motion";

export function PanelSkeleton() {
    return (
        <motion.div
            className="w-full h-full flex flex-col"
            initial={{ opacity: 0.65 }}
            animate={{ opacity: 1 }}
            transition={BF_PAGE_TRANSITION}
        >
            {/* Fake TopBar to prevent layout shift */}
            <div className="relative h-16 border-b border-white/5 bg-slate-950 mb-6 flex items-center px-6 justify-between overflow-hidden">
                <div className="bf-skeleton-shimmer-overlay pointer-events-none absolute inset-0 opacity-40" aria-hidden />
                <BookFastMarkAnimated
                    size={32}
                    intensity="subtle"
                    glow={false}
                    decorative
                    className="opacity-40 relative z-[1]"
                />
                <div className="h-8 w-8 rounded-full bg-white/[0.06] relative z-[1] motion-safe:animate-pulse" />
            </div>

            {/* Content Area */}
            <div className="flex-1 px-6 pb-6 motion-safe:animate-pulse">
                <DashboardSkeleton />
            </div>
        </motion.div>
    );
}
