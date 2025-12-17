"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Users, Scissors, Settings, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

interface BottomNavBarProps {
  className?: string;
}

const navItems = [
  { href: "/panel", label: "Inicio", icon: LayoutDashboard },
  { href: "/panel/agenda", label: "Agenda", icon: Calendar },
  { href: "/panel/clientes", label: "Clientes", icon: Users },
  { href: "/panel/servicios", label: "Servicios", icon: Scissors },
  { href: "/panel/ajustes", label: "Ajustes", icon: Settings },
];

export function BottomNavBar({ className }: BottomNavBarProps) {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          
          // Solo ocultar/mostrar si hay scroll significativo
          if (Math.abs(currentScrollY - lastScrollY) > 10) {
            setIsVisible(currentScrollY < lastScrollY || currentScrollY < 10);
            setLastScrollY(currentScrollY);
          }
          
          ticking = false;
        });
        ticking = true;
      }
    };

    // Solo escuchar scroll en el contenedor principal, no en window
    const mainContent = document.querySelector("main");
    if (mainContent) {
      mainContent.addEventListener("scroll", handleScroll, { passive: true });
      return () => mainContent.removeEventListener("scroll", handleScroll);
    } else {
      // Fallback: escuchar scroll en window si no hay main
      window.addEventListener("scroll", handleScroll, { passive: true });
      return () => window.removeEventListener("scroll", handleScroll);
    }
  }, [lastScrollY]);

  const isActive = (href: string) => {
    if (href === "/panel") {
      return pathname === "/panel" || pathname === "/panel/";
    }
    return pathname === href || pathname?.startsWith(href + "/");
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.nav
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
          className={cn(
            "fixed bottom-0 left-0 right-0 z-50 md:hidden",
            "border-t border-[rgba(255,255,255,0.08)]",
            "bg-[var(--bg-primary)]/98 backdrop-blur-xl safe-area-pb",
            className
          )}
          style={{
            boxShadow: "0px -4px 24px rgba(0,0,0,0.2)",
          }}
        >
          <div className="flex items-center justify-around h-16 px-1">
            {navItems.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 flex-1 h-full py-1.5 px-2 rounded-xl transition-all duration-200 relative",
                    active
                      ? "text-[var(--accent-aqua)]"
                      : "text-[var(--text-secondary)] active:text-[var(--text-primary)]"
                  )}
                >
                  <motion.div
                    animate={{
                      scale: active ? 1.1 : 1,
                      y: active ? -1 : 0,
                    }}
                    transition={{ duration: 0.2 }}
                    className="relative z-10 p-1"
                  >
                    <Icon className="h-5 w-5" />
                  </motion.div>
                  <span
                    className={cn(
                      "text-[10px] font-satoshi relative z-10 leading-tight",
                      active ? "font-semibold" : "font-medium"
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </motion.nav>
      )}
    </AnimatePresence>
  );
}




