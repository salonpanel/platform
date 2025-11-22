"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { getMotionSafeProps } from "../motion/presets";

interface LoadingSkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  className,
  width = "100%",
  height = "1rem",
  borderRadius = "0.375rem",
}) => {
  return (
    <motion.div
      {...getMotionSafeProps({
        initial: { opacity: 0.5 },
        animate: {
          opacity: [0.5, 1, 0.5],
        },
        transition: {
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut",
        },
      })}
      className={cn(
        "bg-gradient-to-r from-border-default via-border-hover to-border-default bg-[length:200%_100%]",
        className
      )}
      style={{
        width,
        height,
        borderRadius,
        backgroundImage: "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)",
        backgroundSize: "200% 100%",
        animation: "shimmer 2s infinite",
      }}
    />
  );
};

// Appointment card skeleton
export const AppointmentCardSkeleton: React.FC = () => {
  return (
    <motion.div
      {...getMotionSafeProps({
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.2 },
      })}
      className="absolute left-3 right-3 rounded-xl bg-glass border border-border-default p-3"
      style={{
        top: "0px",
        height: "80px",
        minHeight: "48px",
      }}
    >
      <div className="flex flex-col h-full gap-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <LoadingSkeleton width="80px" height="14px" />
          <LoadingSkeleton width="40px" height="20px" borderRadius="8px" />
        </div>

        {/* Content */}
        <div className="flex-1 space-y-2">
          <LoadingSkeleton width="120px" height="16px" />
          <LoadingSkeleton width="80px" height="12px" />
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2">
          <LoadingSkeleton width="50px" height="14px" />
        </div>
      </div>
    </motion.div>
  );
};

// Staff column skeleton
export const StaffColumnSkeleton: React.FC = () => {
  return (
    <motion.div
      {...getMotionSafeProps({
        initial: { opacity: 0, x: 12 },
        animate: { opacity: 1, x: 0 },
        transition: { duration: 0.3 },
      })}
      className="flex-1 min-w-[300px] border-r border-border-default last:border-r-0 relative bg-primary"
    >
      {/* Header */}
      <div className="sticky top-0 z-20 px-5 py-4 flex-shrink-0" style={{ height: "72px" }}>
        <div className="h-full flex items-center gap-3">
          <LoadingSkeleton width="32px" height="32px" borderRadius="50%" />
          <div className="flex-1 space-y-2">
            <LoadingSkeleton width="120px" height="16px" />
            <LoadingSkeleton width="80px" height="12px" />
          </div>
        </div>
      </div>

      {/* Content area with skeleton bookings */}
      <div className="relative flex-1 bg-primary p-3 space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <AppointmentCardSkeleton key={index} />
        ))}
      </div>
    </motion.div>
  );
};

// Full calendar skeleton
export const CalendarSkeleton: React.FC<{ staffCount?: number }> = ({
  staffCount = 3
}) => {
  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-primary">
      <div className="relative flex-1 overflow-x-auto overflow-y-hidden scrollbar-hide">
        <div className="flex h-full" style={{ minWidth: `${staffCount * 300}px` }}>
          {/* Time column skeleton */}
          <div className="w-20 border-r border-border-default bg-primary sticky left-0 z-10 flex flex-col h-full">
            <div className="sticky top-0 z-20 bg-primary border-b border-border-default px-4 py-4 backdrop-blur-md flex items-center flex-shrink-0" style={{ height: "72px" }}>
              <LoadingSkeleton width="60px" height="14px" />
            </div>
            <div className="relative flex-1 bg-primary space-y-4 p-3">
              {Array.from({ length: 8 }).map((_, index) => (
                <LoadingSkeleton
                  key={index}
                  width="60px"
                  height="14px"
                  className="mx-auto"
                />
              ))}
            </div>
          </div>

          {/* Staff columns skeleton */}
          {Array.from({ length: staffCount }).map((_, index) => (
            <StaffColumnSkeleton key={index} />
          ))}
        </div>
      </div>
    </div>
  );
};
