"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Calendar,
  Users,
  MessageSquare,
  MoreHorizontal,
  X,
  Wallet,
  Target,
  Scissors,
  User,
  Settings
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon?: string | null;
}

interface MobileBottomNavProps {
  items: NavItem[];
}

export function MobileBottomNav({ items }: MobileBottomNavProps) {
  const pathname = usePathname();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const getNavIcon = useCallback((href: string): React.ReactNode => {
    const iconClass = "h-5 w-5";
    switch (href) {
      case "/panel":
        return <LayoutDashboard className={iconClass} />;
      case "/panel/agenda":
        return <Calendar className={iconClass} />;
      case "/panel/clientes":
        return <Users className={iconClass} />;
      case "/panel/servicios":
        return <Scissors className={iconClass} />;
      case "/panel/staff":
        return <User className={iconClass} />;
      case "/panel/monedero":
        return <Wallet className={iconClass} />;
      case "/panel/marketing":
        return <Target className={iconClass} />;
      case "/panel/chat":
        return <MessageSquare className={iconClass} />;
      case "/panel/ajustes":
        return <Settings className={iconClass} />;
      default:
        return null;
    }
  }, []);

  const isActive = useCallback((href: string) => {
    if (href === "/panel") {
      return pathname === "/panel" || pathname === "/panel/";
    }
    return pathname === href || pathname?.startsWith(href + "/");
  }, [pathname]);

  // Opciones principales para el bottom nav (máximo 5)
  const mainItems = [
    { href: "/panel", label: "Inicio" },
    { href: "/panel/agenda", label: "Agenda" },
    { href: "/panel/clientes", label: "Clientes" },
    { href: "/panel/chat", label: "Chat" },
  ];

  // Opciones restantes para el menú "Más"
  const moreItems = items.filter(item => 
    !mainItems.some(mainItem => mainItem.href === item.href)
  );

  // Check if any of the "more" items is active
  const isMoreActive = moreItems.some(item => isActive(item.href));

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-[rgba(255,255,255,0.08)] bg-[var(--bg-primary)]/98 backdrop-blur-xl safe-area-pb">
        <div className="flex items-center justify-around h-16 px-1">
          {mainItems.map((item) => {
            const active = isActive(item.href);
            const icon = getNavIcon(item.href);

            return (
              <motion.div
                key={item.href}
                className="flex-1 flex items-center justify-center"
                whileTap={{ scale: 0.92 }}
              >
                <Link
                  href={item.href}
                  prefetch={true}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 py-1.5 px-2 rounded-xl transition-all duration-200 relative min-w-[56px]",
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
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 25,
                    }}
                    className="relative z-10 p-1"
                  >
                    {icon}
                  </motion.div>

                  <span
                    className={cn(
                      "text-[10px] font-satoshi relative z-10 leading-tight",
                      active ? "font-semibold text-[var(--accent-aqua)]" : "font-medium"
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              </motion.div>
            );
          })}

          {/* More Options */}
          <motion.div
            className="flex-1 flex items-center justify-center"
            whileTap={{ scale: 0.92 }}
          >
            <button
              onClick={() => setShowMoreMenu(true)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 py-1.5 px-2 rounded-xl transition-all duration-200 relative min-w-[56px]",
                isMoreActive
                  ? "text-[var(--accent-aqua)]"
                  : "text-[var(--text-secondary)] active:text-[var(--text-primary)]"
              )}
            >
              <motion.div
                animate={{
                  scale: showMoreMenu ? 1.1 : 1,
                  rotate: showMoreMenu ? 90 : 0,
                }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 25,
                }}
                className="relative z-10 p-1"
              >
                <MoreHorizontal className="h-5 w-5" />
              </motion.div>

              <span className={cn(
                "text-[10px] font-satoshi relative z-10 leading-tight",
                isMoreActive ? "font-semibold text-[var(--accent-aqua)]" : "font-medium"
              )}>
                Más
              </span>
            </button>
          </motion.div>
        </div>
      </nav>

      {/* More Options Modal/Sheet */}
      <AnimatePresence>
        {showMoreMenu && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setShowMoreMenu(false)}
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 350 }}
              className="fixed bottom-0 left-0 right-0 z-50 border-t border-[rgba(255,255,255,0.1)] bg-[var(--bg-primary)] backdrop-blur-xl rounded-t-3xl md:hidden safe-area-pb"
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-[var(--text-tertiary)]/40" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-[rgba(255,255,255,0.08)]">
                <h3 className="text-base font-semibold text-[var(--text-primary)] font-satoshi">
                  Más opciones
                </h3>
                <button
                  onClick={() => setShowMoreMenu(false)}
                  className="p-2 -mr-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.08)] transition-all duration-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Options Grid */}
              <div className="grid grid-cols-3 gap-2 p-4 pb-6 max-h-80 overflow-y-auto">
                {moreItems.map((item, index) => {
                  const active = isActive(item.href);
                  const icon = getNavIcon(item.href);

                  return (
                    <motion.div
                      key={item.href}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Link
                        href={item.href}
                        prefetch={true}
                        onClick={() => setShowMoreMenu(false)}
                        className={cn(
                          "flex flex-col items-center justify-center gap-2 p-3 rounded-xl transition-all duration-200 min-h-[80px]",
                          active
                            ? "gradient-aurora-1 text-white shadow-lg ring-1 ring-white/20"
                            : "text-[var(--text-secondary)] bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] active:bg-[rgba(255,255,255,0.08)]"
                        )}
                      >
                        <motion.div
                          animate={{
                            scale: active ? 1.1 : 1,
                          }}
                          transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 25,
                          }}
                          className="p-2"
                        >
                          {icon}
                        </motion.div>

                        <span className={cn(
                          "text-xs font-medium font-satoshi text-center leading-tight",
                          active ? "text-white font-semibold" : "text-[var(--text-secondary)]"
                        )}>
                          {item.label}
                        </span>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
