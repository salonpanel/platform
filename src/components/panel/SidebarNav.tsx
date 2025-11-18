"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  ChevronRight
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

const getNavIcon = (href: string): React.ReactNode => {
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
    case "/panel/chat":
      return <MessageSquare className={iconClass} />;
    case "/panel/ajustes":
      return <Settings className={iconClass} />;
    default:
      return null;
  }
};

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

  const isActive = (href: string) => {
    if (href === "/panel") {
      return pathname === "/panel" || pathname === "/panel/";
    }
    return pathname === href || pathname?.startsWith(href + "/");
  };

  // Cuando está colapsado y se hace hover, expandir temporalmente
  const isExpanded = isCollapsed ? isHovered : true;

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
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "fixed md:static inset-y-0 left-0 z-50 glass flex flex-col transition-all duration-300 ease-in-out",
          "bg-[var(--bg-primary)] backdrop-blur-xl border-r border-[rgba(255,255,255,0.1)] sidebar-no-shadow",
          "md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{
          borderRadius: "0 var(--radius-xl) var(--radius-xl) 0",
          boxShadow: "none",
          width: isExpanded ? 240 : 64,
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
          <button
            onClick={onToggleCollapse}
            className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full glass border border-[rgba(255,255,255,0.1)] items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.12)] transition-all duration-200 z-10"
            aria-label={isCollapsed ? "Expandir sidebar" : "Colapsar sidebar"}
            title={isCollapsed ? "Expandir sidebar" : "Colapsar sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
          
          {/* Botón cerrar (solo visible en mobile) */}
          <button
            onClick={onClose}
            className="md:hidden text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1.5 rounded-[var(--radius-sm)] hover:bg-[rgba(255,255,255,0.08)] transition-all duration-200"
            aria-label="Cerrar menú"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 scrollbar-hide">
          <ul className="space-y-1.5">
            {items.map((item, index) => {
              const active = isActive(item.href);
              const icon = getNavIcon(item.href);
              
              return (
                <motion.li
                  key={item.href}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.2 }}
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
                      "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium font-satoshi transition-all duration-200 relative group",
                      "overflow-hidden",
                      active
                        ? "gradient-aurora-1 text-white shadow-[0px_4px_16px_rgba(123,92,255,0.3)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.06)]"
                    )}
                    style={{
                      borderRadius: "var(--radius-md)",
                      minHeight: "40px",
                    }}
                    title={!isExpanded ? item.label : undefined}
                  >
                    <motion.span
                      animate={{ 
                        scale: active ? 1.1 : 1,
                        rotate: active ? [0, -5, 5, 0] : 0,
                      }}
                      transition={{ duration: 0.3 }}
                      className={cn(
                        "flex-shrink-0 transition-colors",
                        active ? "text-white" : "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"
                      )}
                    >
                      {icon}
                    </motion.span>
                    <AnimatePresence mode="wait">
                      {isExpanded && (
                        <motion.span
                          key="label"
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: "auto" }}
                          exit={{ opacity: 0, width: 0 }}
                          transition={{ duration: 0.2 }}
                          className="flex-1 truncate whitespace-nowrap"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {active && isExpanded && (
                      <motion.div
                        layoutId="activeIndicator"
                        className="absolute right-2 w-1.5 h-1.5 rounded-full bg-white/90 shadow-[0px_0px_8px_rgba(255,255,255,0.6)]"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                  </Link>
                </motion.li>
              );
            })}
          </ul>
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
            className="flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.06)] transition-all duration-200 font-satoshi group overflow-hidden"
            style={{
              borderRadius: "var(--radius-md)",
              minHeight: "40px",
            }}
            title={!isExpanded ? "Cerrar sesión" : undefined}
          >
            <LogOut className="h-4 w-4 flex-shrink-0 text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors" />
            <AnimatePresence mode="wait">
              {isExpanded && (
                <motion.span
                  key="logout-label"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex-1 whitespace-nowrap"
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
