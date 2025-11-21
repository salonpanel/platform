"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface StaffSelectorCompactProps {
  staff: Array<{ id: string; name: string; avatar?: string }>;
  selectedStaffId?: string;
  onSelect?: (staffId: string) => void;
  density?: "default" | "compact" | "ultra-compact";
  className?: string;
}

/**
 * Selector horizontal compacto de staff para Agenda
 */
export function StaffSelectorCompact({
  staff,
  selectedStaffId,
  onSelect,
  density = "default",
  className,
}: StaffSelectorCompactProps) {
  const paddingStyles = {
    default: "px-2 py-1",
    compact: "px-1.5 py-0.5",
    "ultra-compact": "px-1 py-0.5",
  };

  const textStyles = {
    default: "text-xs",
    compact: "text-[10px]",
    "ultra-compact": "text-[9px]",
  };

  return (
    <div
      className={cn(
        "flex gap-2 overflow-x-auto scrollbar-hide",
        paddingStyles[density],
        className
      )}
    >
      {staff.map((member) => {
        const isSelected = selectedStaffId === member.id;
        return (
          <motion.button
            key={member.id}
            onClick={() => onSelect?.(member.id)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "flex-shrink-0 rounded-[var(--radius-md)] border transition-all",
              paddingStyles[density],
              isSelected
                ? "bg-[var(--accent-aqua-glass)] border-[var(--accent-aqua-border)] text-[var(--accent-aqua)]"
                : "glass border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-[var(--accent-aqua-border)]/50",
              textStyles[density]
            )}
            style={{
              fontFamily: "var(--font-body)",
              transitionDuration: "var(--duration-base)",
            }}
          >
            {member.avatar ? (
              <img
                src={member.avatar}
                alt={member.name}
                className="w-4 h-4 rounded-full mr-1"
              />
            ) : (
              <span className="w-4 h-4 rounded-full bg-[var(--accent-aqua-glass)] border border-[var(--accent-aqua-border)] flex items-center justify-center mr-1 text-[8px]">
                {member.name.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="truncate max-w-[80px]">{member.name}</span>
          </motion.button>
        );
      })}
    </div>
  );
}




