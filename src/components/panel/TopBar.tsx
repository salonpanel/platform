"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Settings, LogOut, Building2 } from "lucide-react";
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
  // timezone and onMenuClick kept for backwards compatibility but not used
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  timezone,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onMenuClick,
  sidebarCollapsed = false,
}: TopBarProps) {
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
      "relative pb-8 pt-6 md:pt-8",
      sidebarCollapsed ? "px-6 md:px-8" : "px-6 md:px-10"
    )}>
      {/* Elegant divider line */}
      <div 
        className="absolute bottom-0 left-6 right-6"
        style={{
          height: "1px",
          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 20%, rgba(255,255,255,0.08) 80%, transparent 100%)",
        }}
      />
      
      {/* Clean single-line header */}
      <div className="flex items-center justify-between w-full">
        {/* Page Title - Simple and elegant */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex-1 min-w-0"
        >
          <h1 
            className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight font-satoshi"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.7) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {title}
          </h1>
        </motion.div>

        {/* User menu - Minimal and elegant */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          className="flex items-center gap-3 flex-shrink-0"
        >
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-xl",
                "bg-white/[0.03] hover:bg-white/[0.06]",
                "border border-white/[0.06] hover:border-white/[0.12]",
                "transition-all duration-300",
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
                  "h-4 w-4 text-white/40",
                  "transition-all duration-300",
                  "group-hover:text-white/60",
                  dropdownOpen && "rotate-180 text-white/60"
                )} 
              />
            </button>

            {/* Elegant dropdown menu */}
            <AnimatePresence>
              {dropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className={cn(
                    "absolute right-0 mt-2 w-64",
                    "rounded-2xl overflow-hidden",
                    "bg-[rgba(15,23,42,0.95)] backdrop-blur-xl",
                    "border border-white/[0.08]",
                    "shadow-[0_20px_60px_rgba(0,0,0,0.5)]",
                    "z-50"
                  )}
                >
                  {/* User info section */}
                  <div className="px-4 py-4 border-b border-white/[0.06]">
                    <div className="flex items-start gap-3">
                      <Avatar
                        src={userAvatar || undefined}
                        name={userName || userEmail || undefined}
                        size="md"
                        className="ring-2 ring-white/10 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white/95 font-satoshi truncate">
                          {userName || userEmail?.split("@")[0] || "Usuario"}
                        </p>
                        <p className="text-xs text-white/50 truncate mt-0.5 font-inter">
                          {userEmail || ""}
                        </p>
                      </div>
                    </div>
                    
                    {/* Tenant info */}
                    <div className={cn(
                      "mt-3 pt-3 border-t border-white/[0.06]",
                      "flex items-center gap-2"
                    )}>
                      <Building2 className="h-3.5 w-3.5 text-white/40 flex-shrink-0" />
                      <span className="text-xs text-white/60 truncate font-inter">
                        {tenantName}
                      </span>
                      {userRole && (
                        <>
                          <span className="text-white/30">•</span>
                          <span className={cn(
                            "px-2 py-0.5 rounded-md text-xs font-medium",
                            "bg-emerald-500/10 text-emerald-400",
                            "border border-emerald-500/20"
                          )}>
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
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl",
                        "text-sm font-medium text-white/70",
                        "hover:text-white/95 hover:bg-white/[0.06]",
                        "transition-all duration-200"
                      )}
                    >
                      <Settings className="h-4 w-4" />
                      <span>Configuración</span>
                    </a>
                    <a
                      href="/logout"
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl",
                        "text-sm font-medium text-red-400/90",
                        "hover:text-red-400 hover:bg-red-500/10",
                        "transition-all duration-200 mt-1"
                      )}
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
      </div>
    </div>
  );
}
