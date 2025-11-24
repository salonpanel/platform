"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Scissors,
  User,
  MessageSquare,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Wallet,
  Target
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon?: string | null;
}

interface SidebarNavProps {
  items: NavItem[];
  tenantName: string;
  isOpen?: boolean;
  isCollapsed?: boolean;
  onClose?: () => void;
  onToggleCollapse?: () => void;
  autoCollapseOnClick?: boolean; // Nueva prop para auto-colapsar al hacer click
}

export function SidebarNav({
  items,
  tenantName,
  isOpen = true,
  isCollapsed = false,
  onClose,
  onToggleCollapse,
  autoCollapseOnClick = true, // Por defecto, auto-colapsar al hacer click
}: SidebarNavProps) {
  const pathname = usePathname();
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);
  const leaveTimeoutRef = useRef<number | null>(null);

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

  // Memoizar el estado expandido para mejor rendimiento
  const isExpanded = useMemo(() => isCollapsed ? isHovered : true, [isCollapsed, isHovered]);

  // Función para manejar hover con delay inteligente
  const handleMouseEnter = useCallback(() => {
    if (!isCollapsed) return;

    // Limpiar timeout de salida si existe
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }

    // Agregar delay pequeño para evitar expansiones accidentales
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(true);
    }, 100);
  }, [isCollapsed]);

  const handleMouseLeave = useCallback(() => {
    if (!isCollapsed) return;

    // Limpiar timeout de entrada si existe
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    // Delay mínimo para evitar colapsos accidentales
    leaveTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 200);
  }, [isCollapsed]);

  // Limpiar timeouts al desmontar
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
    };
  }, []);

  // Resetear hover cuando cambia el estado de colapsado
  useEffect(() => {
    if (!isCollapsed) {
      setIsHovered(false);
      setHoveredItem(null);
    }
  }, [isCollapsed]);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-md z-40 md:hidden"
          onClick={onClose}
          style={{ zIndex: 40 }}
        />
      )}

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          width: isExpanded ? 240 : 64,
        }}
        transition={{
          type: "spring",
          damping: 30,
          stiffness: 250,
          mass: 0.8,
          duration: 0.4
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "fixed md:static inset-y-0 left-0 z-50 glass flex flex-col transition-all duration-300 ease-out",
          "bg-[var(--bg-primary)] backdrop-blur-xl border-r border-[rgba(255,255,255,0.1)] sidebar-no-shadow",
          "md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
          "shadow-[0px_0px_40px_rgba(0,0,0,0.3)]"
        )}
        style={{
          borderRadius: "0 var(--radius-xl) var(--radius-xl) 0",
        }}
      >
        {/* Logo/Name y botón toggle */}
        <div className="flex h-16 items-center justify-between border-b border-[rgba(255,255,255,0.1)] px-5 glass-subtle relative">
          <AnimatePresence mode="wait">
            {isExpanded ? (
              <motion.h1
                key="title"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="text-base font-semibold text-[var(--text-primary)] truncate font-satoshi tracking-tight whitespace-nowrap"
              >
                {tenantName}
              </motion.h1>
            ) : (
              <motion.div
                key="icon"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
                className="h-8 w-8 rounded-full gradient-aurora-1 flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
              >
                {tenantName.charAt(0).toUpperCase()}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Botón toggle (solo visible en desktop) */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onToggleCollapse}
            className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full glass-strong border border-[rgba(255,255,255,0.15)] items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.15)] hover:shadow-[0px_0px_20px_rgba(123,92,255,0.3)] transition-all duration-300 z-10"
            aria-label={isCollapsed ? "Expandir sidebar" : "Colapsar sidebar"}
            title={isCollapsed ? "Expandir sidebar" : "Colapsar sidebar"}
          >
            <motion.div
              animate={{ rotate: isCollapsed ? 0 : 180 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </motion.div>
          </motion.button>

          {/* Botón cerrar (solo visible en mobile) */}
          <button
            onClick={onClose}
            className="md:hidden text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1.5 rounded-[var(--radius-sm)] hover:bg-[rgba(255,255,255,0.08)] transition-all duration-200"
            aria-label="Cerrar menú"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation - Scroll interno propio si supera altura disponible */}
        <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 scrollbar-hide">
          <motion.ul
            className="space-y-1.5"
            initial="collapsed"
            animate="expanded"
            variants={{
              expanded: {
                transition: {
                  staggerChildren: 0.05,
                  delayChildren: 0.1,
                }
              },
              collapsed: {}
            }}
          >
            {items.map((item, index) => {
              const active = isActive(item.href);
              const icon = getNavIcon(item.href);
              const isItemHovered = hoveredItem === item.href;

              return (
                <motion.li
                  key={item.href}
                  variants={{
                    expanded: {
                      opacity: 1,
                      x: 0,
                      scale: 1,
                      transition: {
                        type: "spring",
                        stiffness: 300,
                        damping: 30,
                        delay: index * 0.02
                      }
                    },
                    collapsed: {
                      opacity: 0,
                      x: -20,
                      scale: 0.95,
                      transition: {
                        duration: 0.2,
                        delay: index * 0.01
                      }
                    }
                  }}
                  onMouseEnter={() => setHoveredItem(item.href)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <Link
                    href={item.href}
                    onClick={() => {
                      // En mobile, cerrar el sidebar completamente
                      if (typeof window !== "undefined" && window.innerWidth < 768) {
                        if (onClose) onClose();
                      } else {
                        // En desktop, si autoCollapseOnClick está activado, colapsarlo automáticamente
                        if (autoCollapseOnClick && !isCollapsed && onToggleCollapse) {
                          // Usar setTimeout para permitir que la navegación se complete primero
                          setTimeout(() => {
                            onToggleCollapse();
                            // Guardar en localStorage
                            if (typeof window !== "undefined") {
                              localStorage.setItem("sidebarCollapsed", "true");
                            }
                          }, 150);
                        }
                      }
                    }}
                    className={cn(
                      "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium font-satoshi transition-all duration-300 relative group overflow-hidden",
                      active
                        ? "gradient-aurora-1 text-white shadow-[0px_4px_16px_rgba(123,92,255,0.4)] ring-1 ring-white/20"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.08)] hover:shadow-[0px_2px_12px_rgba(255,255,255,0.1)]"
                    )}
                    style={{
                      borderRadius: "var(--radius-md)",
                      minHeight: "44px",
                    }}
                    title={!isExpanded ? item.label : undefined}
                  >
                    {/* Ripple effect background */}
                    {isItemHovered && !active && (
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-[var(--accent-aqua)]/10 to-[var(--accent-purple)]/10 rounded-[var(--radius-md)]"
                        layoutId="ripple"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.2 }}
                      />
                    )}

                    <motion.span
                      animate={{
                        scale: active ? 1.1 : isItemHovered ? 1.05 : 1,
                        rotate: active ? [0, -5, 5, 0] : 0,
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 25,
                        duration: active ? 0.5 : 0.2
                      }}
                      className={cn(
                        "flex-shrink-0 relative z-10",
                        active ? "text-white drop-shadow-sm" : "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"
                      )}
                    >
                      {icon}
                      {/* Icon glow effect */}
                      {active && (
                        <motion.div
                          className="absolute inset-0 bg-white/30 rounded-full blur-sm"
                          animate={{
                            opacity: [0.3, 0.6, 0.3],
                            scale: [1, 1.2, 1]
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                          }}
                        />
                      )}
                    </motion.span>
                    <AnimatePresence mode="wait">
                      {isExpanded && (
                        <motion.span
                          key="label"
                          initial={{ opacity: 0, width: 0, x: -10 }}
                          animate={{ opacity: 1, width: "auto", x: 0 }}
                          exit={{ opacity: 0, width: 0, x: -10 }}
                          transition={{
                            type: "spring",
                            stiffness: 300,
                            damping: 30,
                            duration: 0.3
                          }}
                          className="flex-1 truncate whitespace-nowrap relative z-10"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {active && (
                      <motion.div
                        layoutId="activeIndicator"
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white shadow-[0px_0px_12px_rgba(255,255,255,0.8)] ring-2 ring-white/30"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{
                          scale: [0, 1.2, 1],
                          opacity: [0, 1, 1]
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 25,
                          duration: 0.5
                        }}
                      />
                    )}
                  </Link>
                </motion.li>
              );
            })}
          </motion.ul>
        </nav>

        {/* Footer - Logout */}
        <div className="border-t border-[rgba(255,255,255,0.1)] p-3 glass-subtle">
          <Link
            href="/logout"
            onClick={() => {
              // Si está expandido y autoCollapseOnClick está activado, colapsarlo automáticamente
              if (autoCollapseOnClick && !isCollapsed && onToggleCollapse) {
                setTimeout(() => {
                  onToggleCollapse();
                }, 150);
              }
            }}
            className="flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.08)] hover:shadow-[0px_2px_12px_rgba(255,255,255,0.1)] transition-all duration-300 font-satoshi group overflow-hidden relative"
            style={{
              borderRadius: "var(--radius-md)",
              minHeight: "44px",
            }}
            title={!isExpanded ? "Cerrar sesión" : undefined}
          >
            {/* Ripple effect para logout */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-red-400/10 rounded-[var(--radius-md)] opacity-0 group-hover:opacity-100"
              initial={false}
              transition={{ duration: 0.2 }}
            />

            <motion.div
              animate={{
                scale: hoveredItem === "logout" ? 1.05 : 1,
              }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="flex-shrink-0 text-red-400 group-hover:text-red-300 relative z-10"
            >
              <LogOut className="h-4 w-4" />
            </motion.div>
            <AnimatePresence mode="wait">
              {isExpanded && (
                <motion.span
                  key="logout-label"
                  initial={{ opacity: 0, width: 0, x: -10 }}
                  animate={{ opacity: 1, width: "auto", x: 0 }}
                  exit={{ opacity: 0, width: 0, x: -10 }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                    duration: 0.3
                  }}
                  className="flex-1 whitespace-nowrap text-red-400 group-hover:text-red-300 relative z-10"
                >
                  Cerrar sesión
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        </div>
      </motion.aside>
    </>
  );
}