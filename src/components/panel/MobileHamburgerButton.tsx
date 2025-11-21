"use client";

import { motion } from "framer-motion";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileHamburgerButtonProps {
  onMenuClick: () => void;
  className?: string;
}

/**
 * Botón hamburger flotante en esquina inferior derecha para móvil
 * Optimizado para interacción con pulgar derecho
 */
export function MobileHamburgerButton({ onMenuClick, className }: MobileHamburgerButtonProps) {
  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onMenuClick}
      className={cn(
        "fixed bottom-20 right-4 z-40 md:hidden",
        "h-14 w-14 rounded-full",
        "glass border border-[rgba(255,255,255,0.1)]",
        "backdrop-blur-xl",
        "flex items-center justify-center",
        "text-[var(--text-primary)]",
        "shadow-[0px_8px_32px_rgba(0,0,0,0.4),0px_0px_16px_var(--accent-aqua)/20]",
        "hover:shadow-[0px_12px_40px_rgba(0,0,0,0.5),0px_0px_24px_var(--accent-aqua)/30]",
        "transition-all duration-300",
        className
      )}
      style={{
        boxShadow: "0px 8px 32px rgba(0,0,0,0.4), 0px 0px 16px rgba(79, 227, 193, 0.2), inset 0px 1px 0px rgba(255,255,255,0.1)",
      }}
      aria-label="Abrir menú"
    >
      <Menu className="h-6 w-6" />
    </motion.button>
  );
}




