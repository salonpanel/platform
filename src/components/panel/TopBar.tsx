"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Settings, LogOut, Building2 } from "lucide-react";
import { BookFastMarkIcon } from "@/components/brand/BookFastMarkIcon";
import { Avatar } from "@/components/ui/Avatar";
import { useBookfastAiNavBadge } from "@/hooks/useBookfastAiNavBadge";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

interface TopBarProps {
  title: string;
  tenantName: string;
  userRole: string | null;
  timezone: string;
  onMenuClick?: () => void;
  sidebarCollapsed?: boolean;
}

export function TopBar({
  title,
  tenantName,
  userRole,
  // timezone and onMenuClick kept for backwards compatibility but not used
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  timezone,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onMenuClick,
  sidebarCollapsed = false,
}: TopBarProps) {
  const { showUnread: bfAiUnread, showPending: bfAiPending } =
    useBookfastAiNavBadge();
  const supabase = getSupabaseBrowser();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || null);
        setUserName(user.user_metadata?.full_name || null);
        setUserAvatar(user.user_metadata?.avatar_url || null);
      }
    };
    loadUser();
  }, [supabase]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownOpen]);

  return (
    <div className={cn(
      "relative pb-8",
      // Mobile: respect status bar (notch / Dynamic Island / home indicator)
      // Use max() so we always have at least 1rem padding even on devices without safe area
      "pt-safe-top md:pt-8",
      sidebarCollapsed ? "px-6 md:px-8" : "px-6 md:px-10"
    )}>
      {/* Elegant divider line */}
      <div
        className="absolute bottom-0 left-6 right-6"
        style={{
          height: "1px",
          background: "linear-gradient(90deg, transparent 0%, var(--bf-border) 20%, var(--bf-border) 80%, transparent 100%)",
        }}
      />
      
      {/* Header: perfil (izq) · título centrado · IA (dch, móvil) */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 w-full">
        {/* User menu — izquierda */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex justify-start min-w-0"
        >
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-[var(--r-md)]",
                "bg-[var(--bf-bg-elev)] hover:bg-[var(--bf-surface)]",
                "border border-[var(--bf-border)] hover:border-[var(--bf-border-2)]",
                "transition-all duration-200",
                "group"
              )}
            >
              <Avatar
                src={userAvatar || undefined}
                name={userName || userEmail || undefined}
                size="sm"
                className={cn(
                  "ring-2 ring-white/10",
                  "group-hover:ring-white/20",
                  "transition-all duration-300"
                )}
              />
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-[var(--bf-ink-400)]",
                  "transition-all duration-200",
                  "group-hover:text-[var(--bf-ink-200)]",
                  dropdownOpen && "rotate-180"
                )}
              />
            </button>

            <AnimatePresence>
              {dropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className={cn(
                    "absolute left-0 mt-2 w-64",
                    "rounded-[var(--r-xl)] overflow-hidden",
                    "bg-[var(--bf-surface)] border border-[var(--bf-border)]",
                    "shadow-[var(--bf-shadow-card)]",
                    "z-[80]"
                  )}
                >
                  {/* User info section */}
                  <div className="px-4 py-4 border-b border-[var(--bf-border)]">
                    <div className="flex items-start gap-3">
                      <Avatar
                        src={userAvatar || undefined}
                        name={userName || userEmail || undefined}
                        size="md"
                        className="flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-semibold text-[var(--bf-ink-50)] truncate"
                          style={{ fontFamily: "var(--font-sans)" }}
                        >
                          {userName || userEmail?.split("@")[0] || "Usuario"}
                        </p>
                        <p
                          className="text-xs text-[var(--bf-ink-400)] truncate mt-0.5"
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          {userEmail || ""}
                        </p>
                      </div>
                    </div>

                    {/* Tenant info */}
                    <div className="mt-3 pt-3 border-t border-[var(--bf-border)] flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-[var(--bf-ink-400)] flex-shrink-0" />
                      <span
                        className="text-xs text-[var(--bf-ink-300)] truncate"
                        style={{ fontFamily: "var(--font-sans)" }}
                      >
                        {tenantName}
                      </span>
                      {userRole && (
                        <>
                          <span className="text-[var(--bf-ink-400)]">•</span>
                          <span className="px-2 py-0.5 rounded-[var(--r-sm)] text-xs font-medium bg-[rgba(30,161,159,0.12)] text-[var(--bf-teal-200)] border border-[rgba(30,161,159,0.30)]">
                            {userRole}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Menu items */}
                  <div className="p-2">
                    <a
                      href="/panel/ajustes"
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-[var(--r-md)]",
                        "text-sm font-medium text-[var(--bf-ink-300)]",
                        "hover:text-[var(--bf-ink-50)] hover:bg-[var(--bf-bg-elev)]",
                        "transition-all duration-200"
                      )}
                      style={{ fontFamily: "var(--font-sans)" }}
                    >
                      <Settings className="h-4 w-4" />
                      <span>Configuración</span>
                    </a>
                    <a
                      href="/logout"
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-[var(--r-md)]",
                        "text-sm font-medium text-[var(--bf-danger)]",
                        "hover:text-[#F2A0AC] hover:bg-[rgba(224,96,114,0.10)]",
                        "transition-all duration-200 mt-1"
                      )}
                      style={{ fontFamily: "var(--font-sans)" }}
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Cerrar sesión</span>
                    </a>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Título de página — centrado en el ancho del header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
          className="min-w-0 max-w-[min(36rem,calc(100vw-9.5rem))] text-center justify-self-center"
        >
          <h1
            className={cn(
              "truncate leading-snug",
              /* Móvil: discreto y ligero */
              "text-sm font-medium tracking-[-0.015em] text-[var(--bf-ink-100)]",
              /* Tablet/desktop: jerarquía clásica del panel */
              "md:text-2xl md:font-semibold md:tracking-[-0.025em] md:leading-tight md:text-[var(--bf-ink-50)]",
              "lg:text-3xl xl:text-4xl"
            )}
            style={{
              fontFamily: "var(--font-sans)",
            }}
          >
            {title}
          </h1>
        </motion.div>

        {/* BookFast AI — derecha (visible solo en móvil; columna vacía en desktop mantiene el título centrado) */}
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          className="flex justify-end min-w-0"
        >
          <Link
            href="/panel/bookfast-ai"
            aria-label={
              bfAiUnread
                ? "BookFast AI: respuesta lista"
                : bfAiPending
                  ? "BookFast AI: el asistente está respondiendo"
                  : "Abrir BookFast AI"
            }
            className={cn(
              "md:hidden relative flex items-center justify-center",
              "h-10 w-10 rounded-full flex-shrink-0",
              "bg-[var(--bf-primary)]",
              "shadow-[var(--bf-shadow-glow)]",
              "active:scale-95 transition-transform duration-200",
            )}
          >
            {bfAiUnread && (
              <span
                className="absolute -right-0.5 -top-0.5 z-10 h-2.5 w-2.5 rounded-full bg-[var(--bf-danger)] ring-2 ring-[var(--bf-bg)]"
                aria-hidden
              />
            )}
            {!bfAiUnread && bfAiPending && (
              <span
                className="absolute -right-0.5 -top-0.5 z-10 h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--bf-ink)] ring-2 ring-[var(--bf-primary)]"
                aria-hidden
              />
            )}
            <BookFastMarkIcon size={22} className="text-[var(--bf-ink)]" aria-hidden />
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
