"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { User } from "lucide-react";

interface Staff {
  id: string;
  name: string;
  active?: boolean;
}

interface StaffSelectorProps {
  staff: Staff[];
  selectedStaffId: string | null;
  onSelect: (staffId: string | null) => void;
  density?: "default" | "compact" | "ultra-compact";
  className?: string;
}

/**
 * Selector compacto de staff para la agenda
 * Diseño horizontal con scroll si es necesario
 */
export function StaffSelector({
  staff,
  selectedStaffId,
  onSelect,
  density = "default",
  className,
}: StaffSelectorProps) {
  const paddingClass = density === "ultra-compact" ? "p-1.5" : density === "compact" ? "p-2" : "p-2.5";
  const textSize = density === "ultra-compact" ? "text-xs" : density === "compact" ? "text-sm" : "text-base";

  return (
    <div className={cn("flex gap-2 overflow-x-auto scrollbar-hide", className)}>
      {/* Opción "Todos" */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => onSelect(null)}
        className={cn(
          "flex-shrink-0 flex items-center gap-2 rounded-[var(--radius-md)] border transition-all",
          paddingClass,
          selectedStaffId === null
            ? "bg-[var(--accent-aqua-glass)] border-[var(--accent-aqua-border)] text-[var(--accent-aqua)]"
            : "bg-[var(--glass-bg-subtle)] border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        )}
        style={{
          transitionDuration: "var(--duration-base)",
        }}
      >
        <User className={cn(density === "ultra-compact" ? "h-3.5 w-3.5" : "h-4 w-4")} />
        <span className={cn("font-medium font-satoshi", textSize)}>Todos</span>
      </motion.button>

      {/* Lista de staff */}
      {staff.map((member) => {
        const isSelected = selectedStaffId === member.id;
        return (
          <motion.button
            key={member.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect(member.id)}
            className={cn(
              "flex-shrink-0 flex items-center gap-2 rounded-[var(--radius-md)] border transition-all",
              paddingClass,
              isSelected
                ? "bg-[var(--accent-aqua-glass)] border-[var(--accent-aqua-border)] text-[var(--accent-aqua)]"
                : "bg-[var(--glass-bg-subtle)] border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            )}
            style={{
              transitionDuration: "var(--duration-base)",
            }}
          >
            <div
              className={cn(
                "rounded-full bg-[var(--accent-aqua-glass)] border border-[var(--accent-aqua-border)] flex items-center justify-center",
                density === "ultra-compact" ? "h-5 w-5" : density === "compact" ? "h-6 w-6" : "h-7 w-7"
              )}
            >
              <span
                className={cn(
                  "font-semibold font-satoshi",
                  density === "ultra-compact" ? "text-[10px]" : density === "compact" ? "text-xs" : "text-sm"
                )}
                style={{ color: "var(--accent-aqua)" }}
              >
                {member.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className={cn("font-medium font-satoshi truncate max-w-[100px]", textSize)}>
              {member.name}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}




