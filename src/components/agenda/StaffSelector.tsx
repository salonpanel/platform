"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { User, Check } from "lucide-react";

interface Staff {
  id: string;
  name: string;
  active?: boolean;
  avatar?: string;
  utilization?: number;
}

interface StaffSelectorProps {
  staff: Staff[];
  selectedStaffId: string | null;
  onSelect: (staffId: string | null) => void;
  density?: "default" | "compact" | "ultra-compact";
  className?: string;
  showUtilization?: boolean;
}

/**
 * Selector premium de staff para la agenda
 * Con avatares, indicadores de utilización y diseño glassmórfico
 */
export function StaffSelector({
  staff,
  selectedStaffId,
  onSelect,
  density = "default",
  className,
  showUtilization = false,
}: StaffSelectorProps) {
  const paddingClass = density === "ultra-compact" ? "p-2" : density === "compact" ? "p-2.5" : "p-3";
  const textSize = density === "ultra-compact" ? "text-xs" : density === "compact" ? "text-sm" : "text-base";
  const avatarSize = density === "ultra-compact" ? "h-6 w-6" : density === "compact" ? "h-7 w-7" : "h-8 w-8";
  
  const getUtilizationColor = (utilization: number = 0) => {
    if (utilization < 40) return "bg-[var(--accent-blue)]/10 border-[var(--accent-blue)]/25 text-[var(--accent-blue)]";
    if (utilization < 80) return "bg-[var(--accent-aqua)]/10 border-[var(--accent-aqua)]/25 text-[var(--accent-aqua)]";
    return "bg-[var(--accent-purple)]/10 border-[var(--accent-purple)]/25 text-[var(--accent-purple)]";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-2 overflow-x-auto scrollbar-hide", className)}
    >
      {/* Opción "Todos" */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => onSelect(null)}
        className={cn(
          "flex-shrink-0 flex items-center gap-2 rounded-[var(--radius-lg)] border backdrop-blur-sm transition-all duration-200",
          paddingClass,
          selectedStaffId === null
            ? "bg-gradient-to-r from-[var(--accent-aqua)]/20 to-[var(--accent-blue)]/20 border-[var(--accent-aqua)]/50 text-[var(--accent-aqua)] shadow-lg shadow-[var(--accent-aqua)]/20"
            : "bg-[var(--glass-bg-subtle)] border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)]"
        )}
        style={{
          background: selectedStaffId === null 
            ? "linear-gradient(135deg, rgba(79, 227, 193, 0.1) 0%, rgba(58, 109, 255, 0.1) 100%)"
            : undefined
        }}
      >
        <div className={cn(
          "rounded-full border flex items-center justify-center",
          avatarSize,
          selectedStaffId === null
            ? "bg-[var(--accent-aqua)]/20 border-[var(--accent-aqua)]/50"
            : "bg-[var(--glass-bg)] border-[var(--glass-border)]"
        )}>
          <User className={cn(
            density === "ultra-compact" ? "h-3 w-3" : density === "compact" ? "h-3.5 w-3.5" : "h-4 w-4"
          )} />
        </div>
        <span className={cn("font-semibold truncate", textSize)} style={{ fontFamily: "var(--font-heading)" }}>
          Todos
        </span>
        {selectedStaffId === null && (
          <Check className={cn(
            "text-[var(--accent-aqua)]",
            density === "ultra-compact" ? "h-3 w-3" : "h-3.5 w-3.5"
          )} />
        )}
      </motion.button>

      {/* Lista de staff */}
      {staff.map((member, index) => {
        const isSelected = selectedStaffId === member.id;
        const initials = member.name
          .split(" ")
          .map(word => word.charAt(0).toUpperCase())
          .slice(0, 2)
          .join("");
        
        return (
          <motion.button
            key={member.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onSelect(member.id)}
            className={cn(
              "flex-shrink-0 flex items-center gap-2 rounded-[var(--radius-lg)] border backdrop-blur-sm transition-all duration-200",
              paddingClass,
              isSelected
                ? "bg-gradient-to-r from-[var(--accent-aqua)]/20 to-[var(--accent-blue)]/20 border-[var(--accent-aqua)]/50 text-[var(--accent-aqua)] shadow-lg shadow-[var(--accent-aqua)]/20"
                : "bg-[var(--glass-bg-subtle)] border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)]"
            )}
            style={{
              background: isSelected 
                ? "linear-gradient(135deg, rgba(79, 227, 193, 0.1) 0%, rgba(58, 109, 255, 0.1) 100%)"
                : undefined
            }}
          >
            {/* Avatar */}
            <div
              className={cn(
                "rounded-full border flex items-center justify-center font-bold",
                avatarSize,
                isSelected
                  ? "bg-[var(--accent-aqua)]/20 border-[var(--accent-aqua)]/50"
                  : "bg-[var(--glass-bg)] border-[var(--glass-border)]"
              )}
            >
              {member.avatar ? (
                <img 
                  src={member.avatar} 
                  alt={member.name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span
                  className={cn(
                    density === "ultra-compact" ? "text-[8px]" : density === "compact" ? "text-[10px]" : "text-xs"
                  )}
                  style={{ color: isSelected ? "var(--accent-aqua)" : "var(--text-primary)" }}
                >
                  {initials}
                </span>
              )}
            </div>
            
            {/* Nombre y utilización */}
            <div className="flex flex-col items-start min-w-0">
              <span className={cn("font-semibold truncate max-w-[100px]", textSize)} style={{ fontFamily: "var(--font-heading)" }}>
                {member.name}
              </span>
              
              {showUtilization && member.utilization !== undefined && (
                <div className={cn(
                  "px-1.5 py-0.5 rounded-md text-[10px] font-medium",
                  getUtilizationColor(member.utilization)
                )}>
                  {member.utilization}%
                </div>
              )}
            </div>
            
            {/* Indicador de selección */}
            {isSelected && (
              <Check className={cn(
                "text-[var(--accent-aqua)] flex-shrink-0",
                density === "ultra-compact" ? "h-3 w-3" : "h-3.5 w-3.5"
              )} />
            )}
          </motion.button>
        );
      })}
    </motion.div>
  );
}




