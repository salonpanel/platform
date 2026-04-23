"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useBookingModal } from "@/contexts/BookingModalContext";
import {
  BarChart3,
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

/** Rutas fijas de la barra inferior (el resto va a «Más»). */
const BAR_HREFS = new Set<string>([
  "/panel/dashboard",
  "/panel/clientes",
  "/panel/agenda",
  "/panel/chat",
]);

/** Orden: Estadísticas, Clientes, (centro Agenda), Chats, Más. */
const NAV_LEFT = [
  { href: "/panel/dashboard", label: "Estadísticas" },
  { href: "/panel/clientes", label: "Clientes" },
] as const;

const NAV_RIGHT = [{ href: "/panel/chat", label: "Chats" }] as const;

const AGENDA_HREF = "/panel";
const LONG_PRESS_MS = 450;

export function MobileBottomNav({ items }: MobileBottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { openCreate } = useBookingModal();
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
      // BookFast AI: al escribir se oculta la barra; no reservar hueco bajo el contenido
      if (
        typeof document !== "undefined" &&
        document.documentElement.hasAttribute("data-bookfast-ai-composer")
      ) {
        document.documentElement.style.setProperty("--bottom-nav-offset", "0px");
        return;
      }
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

    const onComposerChange = () => updateHeight();
    window.addEventListener("bookfast-ai-composer-change", onComposerChange);

    return () => {
      ro.disconnect();
      window.removeEventListener("bookfast-ai-composer-change", onComposerChange);
      document.documentElement.style.removeProperty("--bottom-nav-offset");
    };
  }, []);

  const getNavIcon = useCallback(
    (href: string, size: number = 20): React.ReactNode => {
      const props = { width: size, height: size, strokeWidth: 1.8 };
      switch (href) {
        case "/panel/dashboard":
          return <BarChart3 {...props} />;
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
      if (href === "/panel/dashboard") {
        return pathname === "/panel/dashboard" || pathname?.startsWith("/panel/dashboard/");
      }
      return pathname === href || pathname?.startsWith(href + "/");
    },
    [pathname]
  );

  const moreItems = items.filter((item) => !BAR_HREFS.has(item.href));
  const isMoreActive = moreItems.some((item) => isActive(item.href));

  const agendaActive =
    pathname === "/panel" ||
    pathname === "/panel/agenda" ||
    pathname?.startsWith("/panel/agenda/");

  const openNewBooking = useCallback(() => {
    openCreate(new Date());
  }, [openCreate]);

  const longPressFiredRef = useRef(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const onAgendaCenterPointerDown = useCallback(() => {
    longPressFiredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      longPressTimerRef.current = null;
      openNewBooking();
    }, LONG_PRESS_MS);
  }, [openNewBooking]);

  const onAgendaCenterPointerUpOrCancel = useCallback(() => {
    clearLongPressTimer();
  }, [clearLongPressTimer]);

  const onAgendaCenterClick = useCallback(
    (e: React.MouseEvent) => {
      if (longPressFiredRef.current) {
        e.preventDefault();
        longPressFiredRef.current = false;
        return;
      }
      e.preventDefault();
      router.push(AGENDA_HREF);
    },
    [router]
  );

  const renderLink = (href: string) => {
    const active = isActive(href);
    const icon = getNavIcon(href);
    return (
      <motion.div
        key={href}
        className="flex flex-1 items-center justify-center"
        whileTap={{ scale: 0.86 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      >
        <Link
          href={href}
          prefetch={true}
          onClick={(e) => {
            // Si ya estamos en /panel/chat, reutilizar el botón "Chats" como "volver a la lista"
            if (href === "/panel/chat" && active) {
              e.preventDefault();
              try {
                window.dispatchEvent(new CustomEvent("panel-chat:go-list"));
              } catch {}
            }
          }}
          className="relative flex min-w-[50px] select-none items-center justify-center pb-0"
        >
          <div
            className={cn(
              "flex h-[40px] w-[40px] items-center justify-center rounded-xl transition-all duration-200",
              active ? "text-[var(--bf-primary)]" : "text-[var(--bf-ink-400)]"
            )}
          >
            {icon}
          </div>
        </Link>
      </motion.div>
    );
  };

  return (
    <>
      {/* ───────────────── Bottom Navigation Bar ───────────────── */}
      <nav
        ref={navRef}
        className={cn(
          "panel-mobile-bottom-nav fixed bottom-0 left-0 right-0 z-50 md:hidden",
          "pt-2 pb-[env(safe-area-inset-bottom,0px)]",
          "shadow-[0_-1px_0_rgba(255,255,255,0.06)]"
        )}
        style={{
          background: "var(--neutral-50)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.10) 20%, rgba(79,161,216,0.18) 50%, rgba(255,255,255,0.10) 80%, transparent 100%)",
          }}
        />

        <div className="flex items-end justify-around px-1 pb-0">
          {NAV_LEFT.map(({ href }) => renderLink(href))}

          {/* Centro: calendario (inicio) — toque = agenda; pulsación larga = nueva cita */}
          <motion.div
            className="flex flex-1 items-center justify-center"
            whileTap={{ scale: 0.9 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          >
            <button
              type="button"
              onClick={onAgendaCenterClick}
              onPointerDown={onAgendaCenterPointerDown}
              onPointerUp={onAgendaCenterPointerUpOrCancel}
              onPointerCancel={onAgendaCenterPointerUpOrCancel}
              onPointerLeave={onAgendaCenterPointerUpOrCancel}
              onContextMenu={(e) => e.preventDefault()}
              className={cn(
                "relative flex min-w-[52px] select-none items-center justify-center pb-0 [touch-action:manipulation]",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-aqua)]/50 rounded-2xl"
              )}
              aria-label="Agenda, calendario. Mantén pulsado para añadir una nueva cita"
            >
              <div
                className={cn(
                  "flex items-center justify-center w-11 h-11 rounded-2xl transition-all duration-200",
                  "bg-[var(--bf-primary)]",
                  "text-[var(--bf-ink)]",
                  agendaActive && "ring-2 ring-[rgba(79,161,216,0.4)]"
                )}
              >
                <Calendar className="w-6 h-6" strokeWidth={2.2} aria-hidden />
              </div>
            </button>
          </motion.div>

          {NAV_RIGHT.map(({ href }) => renderLink(href))}

          {/* ── "Más" (incluye Clientes y el resto) ── */}
          <motion.div
            className="flex flex-1 items-center justify-center"
            whileTap={{ scale: 0.86 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          >
            <button
              onClick={() => setShowMoreMenu((v) => !v)}
              className="relative flex min-w-[50px] select-none items-center justify-center pb-0"
              aria-label="Más opciones"
              aria-expanded={showMoreMenu}
            >
              <div
                className={cn(
                  "relative flex items-center justify-center w-[40px] h-[40px] rounded-xl transition-all duration-200",
                  isMoreActive || showMoreMenu ? "text-[var(--bf-primary)]" : "text-[var(--bf-ink-400)]"
                )}
              >
                <MoreHorizontal
                  size={24}
                  strokeWidth={isMoreActive || showMoreMenu ? 2.5 : 2}
                  className="mt-[2px]"
                />
                {isMoreActive && (
                  <span
                    className="absolute top-2 right-2 w-[7px] h-[7px] rounded-full border-2"
                    style={{
                      background: "var(--bf-primary)",
                      borderColor: "var(--bf-bg)",
                    }}
                  />
                )}
              </div>
            </button>
          </motion.div>
        </div>

      </nav>

      {/* ───────────────── "Más" Bottom Sheet ───────────────── */}
      <AnimatePresence>
        {showMoreMenu && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-[52] md:hidden"
              style={{
                background: "rgba(0,0,0,0.52)",
                backdropFilter: "blur(3px)",
                WebkitBackdropFilter: "blur(3px)",
              }}
              onClick={() => setShowMoreMenu(false)}
            />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 z-[56] md:hidden pb-0"
              style={{
                background: "var(--bf-surface)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                borderTop: "1px solid var(--bf-border)",
                borderRadius: "22px 22px 0 0",
              }}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div
                  className="w-9 h-[3px] rounded-full"
                  style={{ background: "rgba(255,255,255,0.18)" }}
                />
              </div>

              <div className="flex items-center justify-between px-5 pt-2 pb-3">
                <h3 className="text-[15px] font-semibold text-[var(--bf-ink-50)]" style={{ fontFamily: "var(--font-sans)" }}>
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

              <div
                className="mx-5 mb-4"
                style={{ height: 1, background: "rgba(255,255,255,0.06)" }}
              />

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
                                background: "rgba(79,161,216,0.10)",
                                border: "1px solid rgba(79,161,216,0.30)",
                                color: "var(--bf-primary)",
                              }
                            : {
                                background: "var(--bf-bg-elev)",
                                border: "1px solid var(--bf-border)",
                                color: "var(--bf-ink-400)",
                              }
                        }
                      >
                        <span>{icon}</span>
                        <span
                          className={cn(
                            "text-[11px] text-center leading-tight",
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
