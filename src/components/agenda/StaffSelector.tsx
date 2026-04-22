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
    if (utilization < 40) return "bg-[var(--bf-primary)]/10 border-[var(--bf-primary)]/25 text-[var(--bf-primary)]";
    if (utilization < 80) return "bg-[var(--bf-primary)]/10 border-[var(--bf-primary)]/25 text-[var(--bf-primary)]";
    return "bg-[var(--bf-primary)]/10 border-[var(--bf-primary)]/25 text-[var(--bf-primary)]";
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
          "flex-shrink-0 flex items-center gap-2 rounded-[var(--r-lg)] border backdrop-blur-sm transition-all duration-200",
          paddingClass,
          selectedStaffId === null
            ? "bg-gradient-to-r from-[var(--bf-primary)]/20 to-[var(--bf-primary)]/20 border-[var(--bf-primary)]/50 text-[var(--bf-primary)] shadow-lg shadow-[var(--bf-primary)]/20"
            : "bg-[var(--bf-bg-elev)] border-[var(--bf-border)] text-[var(--bf-ink-300)] hover:text-[var(--bf-ink-50)] hover:bg-[var(--bf-bg-elev)]"
        )}
        style={{
          background: selectedStaffId === null 
            ? "linear-gradient(135deg, rgba(79, 161, 216, 0.1) 0%, rgba(79, 161, 216, 0.1) 100%)"
            : undefined
        }}
      >
        <div className={cn(
          "rounded-full border flex items-center justify-center",
          avatarSize,
          selectedStaffId === null
            ? "bg-[var(--bf-primary)]/20 border-[var(--bf-primary)]/50"
            : "bg-[var(--bf-bg-elev)] border-[var(--bf-border)]"
        )}>
          <User className={cn(
            density === "ultra-compact" ? "h-3 w-3" : density === "compact" ? "h-3.5 w-3.5" : "h-4 w-4"
          )} />
        </div>
        <span className={cn("font-semibold truncate", textSize)} style={{ fontFamily: "var(--font-sans)" }}>
          Todos
        </span>
        {selectedStaffId === null && (
          <Check className={cn(
            "text-[var(--bf-primary)]",
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
              "flex-shrink-0 flex items-center gap-2 rounded-[var(--r-lg)] border backdrop-blur-sm transition-all duration-200",
              paddingClass,
              isSelected
                ? "bg-gradient-to-r from-[var(--bf-primary)]/20 to-[var(--bf-primary)]/20 border-[var(--bf-primary)]/50 text-[var(--bf-primary)] shadow-lg shadow-[var(--bf-primary)]/20"
                : "bg-[var(--bf-bg-elev)] border-[var(--bf-border)] text-[var(--bf-ink-300)] hover:text-[var(--bf-ink-50)] hover:bg-[var(--bf-bg-elev)]"
            )}
            style={{
              background: isSelected 
                ? "linear-gradient(135deg, rgba(79, 161, 216, 0.1) 0%, rgba(79, 161, 216, 0.1) 100%)"
                : undefined
            }}
          >
            {/* Avatar */}
            <div
              className={cn(
                "rounded-full border flex items-center justify-center font-bold",
                avatarSize,
                isSelected
                  ? "bg-[var(--bf-primary)]/20 border-[var(--bf-primary)]/50"
                  : "bg-[var(--bf-bg-elev)] border-[var(--bf-border)]"
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
                  style={{ color: isSelected ? "var(--bf-primary)" : "var(--bf-ink-50)" }}
                >
                  {initials}
                </span>
              )}
            </div>
            
            {/* Nombre y utilización */}
            <div className="flex flex-col items-start min-w-0">
              <span className={cn("font-semibold truncate max-w-[100px]", textSize)} style={{ fontFamily: "var(--font-sans)" }}>
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
                "text-[var(--bf-primary)] flex-shrink-0",
                density === "ultra-compact" ? "h-3 w-3" : "h-3.5 w-3.5"
              )} />
            )}
          </motion.button>
        );
      })}
    </motion.div>
  );
}




