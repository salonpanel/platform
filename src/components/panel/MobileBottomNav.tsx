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
    { href: "/panel", label: "Dashboard" },
    { href: "/panel/agenda", label: "Agenda" },
    { href: "/panel/clientes", label: "Clientes" },
    { href: "/panel/chat", label: "Chat" },
  ];

  // Opciones restantes para el menú "Más"
  const moreItems = items.filter(item => 
    !mainItems.some(mainItem => mainItem.href === item.href)
  );

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden glass-strong border-t border-[rgba(255,255,255,0.1)] bg-[var(--bg-primary)]/95 backdrop-blur-xl">
        <div className="flex items-center justify-around h-16 px-2">
          {mainItems.map((item, index) => {
            const active = isActive(item.href);
            const icon = getNavIcon(item.href);

            return (
              <motion.div
                key={item.href}
                className="flex-1 flex items-center justify-center"
                whileTap={{ scale: 0.9 }}
              >
                <Link
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg transition-all duration-200 relative",
                    active
                      ? "text-[var(--accent-primary)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  )}
                >
                  {/* Active indicator */}
                  {active && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-x-1 top-1 h-8 rounded-full bg-[var(--accent-primary)]/10"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}

                  <motion.div
                    animate={{
                      scale: active ? 1.1 : 1,
                      y: active ? -2 : 0,
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 25,
                    }}
                    className="relative z-10"
                  >
                    {icon}
                  </motion.div>

                  <motion.span
                    animate={{
                      scale: active ? 0.9 : 0.85,
                      fontWeight: active ? 600 : 400,
                    }}
                    className={cn(
                      "text-xs font-satoshi relative z-10",
                      active ? "text-[var(--accent-primary)] font-semibold" : "text-[var(--text-secondary)]"
                    )}
                  >
                    {item.label.length > 8 ? item.label.substring(0, 7) + "..." : item.label}
                  </motion.span>
                </Link>
              </motion.div>
            );
          })}

          {/* More Options */}
          <motion.div
            className="flex-1 flex items-center justify-center"
            whileTap={{ scale: 0.9 }}
          >
            <button
              onClick={() => setShowMoreMenu(true)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg transition-all duration-200 relative",
                "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              <motion.div
                animate={{
                  scale: showMoreMenu ? 1.1 : 1,
                  rotate: showMoreMenu ? 45 : 0,
                }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 25,
                }}
              >
                <MoreHorizontal className="h-5 w-5" />
              </motion.div>

              <span className="text-xs font-satoshi">
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
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
              onClick={() => setShowMoreMenu(false)}
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 glass-strong border-t border-[rgba(255,255,255,0.1)] bg-[var(--bg-primary)]/95 backdrop-blur-xl rounded-t-2xl"
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-12 h-1 rounded-full bg-[var(--text-secondary)]/30" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(255,255,255,0.1)]">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] font-satoshi">
                  Más opciones
                </h3>
                <button
                  onClick={() => setShowMoreMenu(false)}
                  className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.08)] transition-all duration-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Options Grid */}
              <div className="grid grid-cols-2 gap-3 p-6 max-h-96 overflow-y-auto">
                {moreItems.map((item, index) => {
                  const active = isActive(item.href);
                  const icon = getNavIcon(item.href);

                  return (
                    <motion.div
                      key={item.href}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Link
                        href={item.href}
                        onClick={() => setShowMoreMenu(false)}
                        className={cn(
                          "flex flex-col items-center justify-center gap-3 p-4 rounded-xl transition-all duration-200",
                          active
                            ? "gradient-aurora-1 text-white shadow-lg"
                            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.08)]"
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
                        >
                          {icon}
                        </motion.div>

                        <span className={cn(
                          "text-sm font-medium font-satoshi text-center",
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
