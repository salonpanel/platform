"use client";

import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface FloatingActionButtonProps {
  onClick: () => void;
  className?: string;
}

export function FloatingActionButton({ onClick, className }: FloatingActionButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.05, rotate: 8 }}
      whileTap={{ scale: 0.95 }}
      transition={{ 
        type: "spring", 
        stiffness: 300, 
        damping: 20
      }}
      className={cn(
        "fixed bottom-6 right-6 h-14 w-14 rounded-full z-50",
        "bg-gradient-to-r from-[#3A6DFF] to-[#4FE3C1] text-white",
        "shadow-[0px_8px_32px_rgba(58,109,255,0.4)] hover:shadow-[0px_12px_40px_rgba(79,227,193,0.5)]",
        "transition-all duration-150",
        "flex items-center justify-center",
        "focus:outline-none focus:ring-4 focus:ring-[#3A6DFF]/30 focus:ring-offset-2 focus:ring-offset-[#15171A]",
        className
      )}
      style={{
        borderRadius: "50%",
      }}
      aria-label="Nueva cita"
    >
      <Plus className="h-6 w-6 font-bold" strokeWidth={2.5} />
    </motion.button>
  );
}

