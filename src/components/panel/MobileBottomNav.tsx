"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useCallback, useEffect, useRef } from "react";
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
  Settings,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon?: string | null;
}

interface MobileBottomNavProps {
  items: NavItem[];
}

// Primary nav items (always visible in the bar)
const MAIN_ITEMS = [
  { href: "/panel", label: "Inicio" },
  { href: "/panel/agenda", label: "Agenda" },
  { href: "/panel/clientes", label: "Clientes" },
  { href: "/panel/chat", label: "Chat" },
];

export function MobileBottomNav({ items }: MobileBottomNavProps) {
  const pathname = usePathname();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  // Auto-close "Más" sheet whenever the user navigates
  useEffect(() => {
    setShowMoreMenu(false);
  }, [pathname]);

  // Measure real nav height and publish as CSS variable so other components
  // (modals, content areas) can react to the actual nav size.
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;

    const updateHeight = () => {
      const h = el.getBoundingClientRect().height;
      document.documentElement.style.setProperty(
        "--bottom-nav-offset",
        `${h}px`
      );
    };

    // Initial measurement
    updateHeight();

    // Watch for size changes (e.g. safe-area recalc, orientation change)
    const ro = new ResizeObserver(updateHeight);
    ro.observe(el);

    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty("--bottom-nav-offset");
    };
  }, []);

  const getNavIcon = useCallback(
    (href: string, size: number = 20): React.ReactNode => {
      const props = { width: size, height: size, strokeWidth: 1.8 };
      switch (href) {
        case "/panel":           return <LayoutDashboard {...props} />;
        case "/panel/agenda":    return <Calendar {...props} />;
        case "/panel/clientes":  return <Users {...props} />;
        case "/panel/servicios": return <Scissors {...props} />;
        case "/panel/staff":     return <User {...props} />;
        case "/panel/monedero":  return <Wallet {...props} />;
        case "/panel/marketing": return <Target {...props} />;
        case "/panel/chat":      return <MessageSquare {...props} />;
        case "/panel/ajustes":   return <Settings {...props} />;
        default:                 return null;
      }
    },
    []
  );

  const isActive = useCallback(
    (href: string) => {
      if (href === "/panel") return pathname === "/panel" || pathname === "/panel/";
      return pathname === href || pathname?.startsWith(href + "/");
    },
    [pathname]
  );

  // Items that go into the "Más" sheet
  const moreItems = items.filter(
    (item) => !MAIN_ITEMS.some((m) => m.href === item.href)
  );
  const isMoreActive = moreItems.some((item) => isActive(item.href));

  return (
    <>
      {/* ───────────────── Bottom Navigation Bar ───────────────── */}
      <nav
        ref={navRef}
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
        style={{
          /* iOS PWA Safe Area fix: Instagram style uses padding to fill the bottom */
          paddingBottom: "env(safe-area-inset-bottom)",
          /* Fully opaque background matching the app theme */
          background: "var(--neutral-50)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        {/* Top border + subtle aqua-tinted highlight */}
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.10) 20%, rgba(79,227,193,0.18) 50%, rgba(255,255,255,0.10) 80%, transparent 100%)",
          }}
        />

        {/* Items row — extremely compact */}
        <div className="flex items-center justify-around h-[60px] px-1">
          {MAIN_ITEMS.map((item) => {
            const active = isActive(item.href);
            const icon = getNavIcon(item.href);

            return (
              <motion.div
                key={item.href}
                className="flex-1 flex items-center justify-center"
                whileTap={{ scale: 0.86 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              >
                <Link
                  href={item.href}
                  prefetch={true}
                  className="relative flex items-center justify-center min-w-[50px] select-none h-full"
                >
                  <div
                    className={cn(
                      "flex items-center justify-center w-[40px] h-[40px] rounded-xl transition-all duration-200",
                      active ? "text-[var(--accent-aqua)]" : "text-slate-400"
                    )}
                  >
                    {icon}
                  </div>
                </Link>
              </motion.div>
            );
          })}

          {/* ── "Más" button ── */}
          <motion.div
            className="flex-1 flex items-center justify-center"
            whileTap={{ scale: 0.86 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          >
            <button
              onClick={() => setShowMoreMenu((v) => !v)}
              className="relative flex items-center justify-center min-w-[50px] select-none h-full"
              aria-label="Más opciones"
              aria-expanded={showMoreMenu}
            >
              <div
                className={cn(
                  "relative flex items-center justify-center w-[40px] h-[40px] rounded-xl transition-all duration-200",
                  isMoreActive || showMoreMenu ? "text-[var(--accent-aqua)]" : "text-slate-400"
                )}
              >
                <MoreHorizontal
                  size={24}
                  strokeWidth={isMoreActive || showMoreMenu ? 2.5 : 2}
                  className="mt-[2px]"
                />
                {/* Badge dot when a "more" item is the active route */}
                {isMoreActive && (
                  <span
                    className="absolute top-2 right-2 w-[7px] h-[7px] rounded-full border-2"
                    style={{
                      background: "var(--accent-aqua)",
                      borderColor: "var(--bg-primary)",
                    }}
                  />
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] leading-none font-satoshi transition-all duration-200",
                  isMoreActive || showMoreMenu
                    ? "font-semibold text-[var(--accent-aqua)]"
                    : "font-medium text-[var(--text-tertiary)]"
                )}
              >
                Más
              </span>
            </button>
          </motion.div>
        </div>

      </nav>

      {/* ───────────────── "Más" Bottom Sheet ───────────────── */}
      <AnimatePresence>
        {showMoreMenu && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-40 md:hidden"
              style={{
                background: "rgba(0,0,0,0.52)",
                backdropFilter: "blur(3px)",
                WebkitBackdropFilter: "blur(3px)",
              }}
              onClick={() => setShowMoreMenu(false)}
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 z-50 md:hidden safe-area-pb"
              style={{
                background: "rgba(17, 33, 45, 0.98)",
                backdropFilter: "blur(28px)",
                WebkitBackdropFilter: "blur(28px)",
                borderTop: "1px solid rgba(255,255,255,0.10)",
                borderRadius: "22px 22px 0 0",
              }}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div
                  className="w-9 h-[3px] rounded-full"
                  style={{ background: "rgba(255,255,255,0.18)" }}
                />
              </div>

              {/* Header row */}
              <div className="flex items-center justify-between px-5 pt-2 pb-3">
                <h3 className="text-[15px] font-semibold font-satoshi text-[var(--text-primary)]">
                  Más opciones
                </h3>
                <button
                  onClick={() => setShowMoreMenu(false)}
                  className="flex items-center justify-center w-8 h-8 rounded-xl transition-colors"
                  style={{ color: "var(--text-secondary)" }}
                  aria-label="Cerrar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Thin divider */}
              <div
                className="mx-5 mb-4"
                style={{ height: 1, background: "rgba(255,255,255,0.06)" }}
              />

              {/* Items grid */}
              <div className="grid grid-cols-3 gap-3 px-4 pb-4">
                {moreItems.map((item, index) => {
                  const active = isActive(item.href);
                  const icon = getNavIcon(item.href, 22);

                  return (
                    <motion.div
                      key={item.href}
                      initial={{ opacity: 0, y: 14, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{
                        delay: index * 0.04,
                        type: "spring",
                        stiffness: 380,
                        damping: 28,
                      }}
                      whileTap={{ scale: 0.93 }}
                    >
                      <Link
                        href={item.href}
                        prefetch={true}
                        onClick={() => setShowMoreMenu(false)}
                        className={cn(
                          "flex flex-col items-center justify-center gap-2.5 p-4 rounded-2xl transition-all duration-200",
                          "min-h-[88px]"
                        )}
                        style={
                          active
                            ? {
                                background: "rgba(79,227,193,0.10)",
                                border: "1px solid rgba(79,227,193,0.22)",
                                color: "var(--accent-aqua)",
                              }
                            : {
                                background: "rgba(255,255,255,0.04)",
                                border: "1px solid rgba(255,255,255,0.06)",
                                color: "var(--text-secondary)",
                              }
                        }
                      >
                        <span>{icon}</span>
                        <span
                          className={cn(
                            "text-[11px] font-satoshi text-center leading-tight",
                            active ? "font-semibold" : "font-medium"
                          )}
                        >
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
