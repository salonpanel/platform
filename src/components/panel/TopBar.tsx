"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, ChevronDown, Settings, LogOut, Clock } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
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
  timezone,
  onMenuClick,
  sidebarCollapsed = false,
}: TopBarProps) {
  const supabase = getSupabaseBrowser();
  const [userEmail, setUserEmail] = useState<string | null>(null);
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
    <div className="relative mb-8 pb-6 pt-8 md:pt-12">
      {/* Línea sutil de separación en lugar de borde marcado */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 10%, rgba(255,255,255,0.1) 90%, transparent 100%)",
        }}
      />
      
      {/* Contenido integrado sin cajas */}
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-6 flex-1 min-w-0">
          {/* Mobile menu button */}
          <button
            onClick={onMenuClick}
            className="md:hidden text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-2 -ml-2 rounded-[var(--radius-md)] hover:bg-[rgba(255,255,255,0.04)] transition-all duration-200"
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Title integrado */}
          <div className="flex-1 min-w-0">
            <motion.h1 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-3xl font-bold text-[var(--text-primary)] font-satoshi tracking-tight mb-2"
              style={{
                background: "linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {title}
            </motion.h1>
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              className="flex items-center gap-3 text-sm text-[var(--text-secondary)] font-medium"
            >
              <span className="truncate">{tenantName}</span>
              {userRole && (
                <>
                  <span className="opacity-40">•</span>
                  <span className="px-2 py-0.5 rounded-[var(--radius-sm)] bg-[rgba(77,226,195,0.1)] text-[var(--accent-2)] text-xs font-semibold">
                    {userRole}
                  </span>
                </>
              )}
            </motion.div>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          {/* Timezone indicator integrado (desktop) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="hidden lg:flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-secondary)] font-medium"
          >
            <Clock className="h-3.5 w-3.5" />
            <span className="font-mono">{timezone}</span>
          </motion.div>

          {/* User dropdown integrado */}
          <div className="relative" ref={dropdownRef}>
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25 }}
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-md)] hover:bg-[rgba(255,255,255,0.04)] transition-all duration-200 group"
            >
              <Avatar
                src={userAvatar || undefined}
                name={userEmail || undefined}
                size="sm"
                className="ring-2 ring-[rgba(123,92,255,0.2)] group-hover:ring-[rgba(123,92,255,0.4)] transition-all duration-200"
              />
              <ChevronDown 
                className={cn(
                  "h-4 w-4 text-[var(--text-secondary)] transition-all duration-200",
                  dropdownOpen && "rotate-180"
                )} 
              />
            </motion.button>

            {/* Dropdown menu */}
            <AnimatePresence>
              {dropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="absolute right-0 mt-2 w-56 rounded-[var(--radius-lg)] glass border border-[rgba(255,255,255,0.1)] shadow-[0px_8px_32px_rgba(0,0,0,0.3)] overflow-hidden z-50"
                  style={{
                    borderRadius: "var(--radius-lg)",
                    boxShadow: "0px 8px 32px rgba(0,0,0,0.3), inset 0px 1px 0px rgba(255,255,255,0.1)",
                  }}
                >
                  {/* User info */}
                  <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.1)]">
                    <p className="text-sm font-semibold text-[var(--text-primary)] font-satoshi truncate">
                      {userEmail?.split("@")[0] || "Usuario"}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                      {userEmail || ""}
                    </p>
                    {userRole && (
                      <span className="inline-block mt-2 px-2 py-0.5 text-xs font-medium text-[var(--accent-2)] bg-[rgba(77,226,195,0.1)] rounded-[var(--radius-sm)]">
                        {userRole}
                      </span>
                    )}
                  </div>

                  {/* Menu items */}
                  <div className="p-1.5">
                    <a
                      href="/panel/ajustes"
                      className="flex items-center gap-3 px-3 py-2 rounded-[var(--radius-md)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.06)] transition-all duration-200 font-medium"
                      style={{ borderRadius: "var(--radius-md)" }}
                    >
                      <Settings className="h-4 w-4" />
                      <span>Configuración</span>
                    </a>
                    <a
                      href="/logout"
                      className="flex items-center gap-3 px-3 py-2 rounded-[var(--radius-md)] text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200 font-medium mt-1"
                      style={{ borderRadius: "var(--radius-md)" }}
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Cerrar sesión</span>
                    </a>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
