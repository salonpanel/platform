"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { prefetchData } from "@/hooks/useStaleWhileRevalidate";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
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
  Wallet,
  Target
} from "lucide-react";
import { usePermissions } from "@/contexts/PermissionsContext";

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
  autoCollapseOnClick?: boolean;
}

export function SidebarNav({
  items,
  tenantName,
  isOpen = true,
  isCollapsed = false,
  onClose,
  onToggleCollapse,
  autoCollapseOnClick = true,
}: SidebarNavProps) {
  const pathname = usePathname();
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { permissions, role, tenantId } = usePermissions();
  const router = useRouter();
  const prefetchedKeysRef = useRef<Set<string>>(new Set());

  // Mapeo de rutas a permisos
  const routePermissionMap: Record<string, keyof typeof permissions> = {
    "/panel": "dashboard",
    "/panel/agenda": "agenda",
    "/panel/clientes": "clientes",
    "/panel/servicios": "servicios",
    "/panel/staff": "staff",
    "/panel/marketing": "marketing",
    "/panel/monedero": "reportes",
    "/panel/ajustes": "ajustes",
  };

  // Filtrar items según permisos (sin loading, instantáneo desde el contexto)
  const filteredItems = useMemo(() => {
    // Si es owner/admin, mostrar todo
    if (role === "owner" || role === "admin") {
      return items;
    }

    return items.filter((item) => {
      const permissionKey = routePermissionMap[item.href];
      if (!permissionKey) return true; // Si no está mapeado, mostrar por defecto
      return permissions[permissionKey]; // Mostrar solo si tiene permiso
    });
  }, [items, permissions, role]);

  // Agregar item de logout al final de la navegación
  const navigationItems = useMemo(() => {
    const items = [...filteredItems];
    // Agregar logout al final
    items.push({
      href: "/logout",
      label: "Cerrar sesión",
      icon: "logout"
    });
    return items;
  }, [filteredItems]);

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
      case "/logout":
        return <LogOut className={iconClass} />;
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
    }, 100) as any;
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
    }, 200) as any;
  }, [isCollapsed]);

  // Limpiar timeouts al desmontar
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
    };
  }, []);

  // Prefetch assets + light data when user hovers a nav item
  useEffect(() => {
    if (!hoveredItem) return;

    // Clear any pending prefetch timer
    if (prefetchTimeoutRef.current) {
      clearTimeout(prefetchTimeoutRef.current);
      prefetchTimeoutRef.current = null;
    }

    // Debounce short hover before actually prefetching to avoid noisy requests
    prefetchTimeoutRef.current = setTimeout(async () => {
      try {
        // Prefetch Next route chunk (component bundles)
        router.prefetch(hoveredItem);

        // Lightweight data prefetch: only when tenant context is available
        const supabase = getSupabaseBrowser();
        const tId = tenantId || null;

        // Keep a small helper to avoid duplicate prefetches
        const doPrefetch = async (key: string, fetcher: () => Promise<any>) => {
          // deduplicate
          const set = prefetchedKeysRef.current;
          if (set.has(key)) return;
          set.add(key);
          try {
            await prefetchData(key, fetcher);
          } catch (err) {
            // ignore errors
          }
        };

        // For performance, only prefetch lightweight datasets per route
        if (hoveredItem === "/panel" && tId) {
          const key = `dashboard-full-tenant-${tId}`;
          await doPrefetch(key, async () => {
            const now = new Date();
            const todayStart = new Date(now.setHours(0, 0, 0, 0)).toISOString();
            const todayEnd = new Date(now.setHours(23, 59, 59, 999)).toISOString();

            const [bookingsRes, servicesRes, staffRes, upcomingRes] = await Promise.all([
              supabase
                .from("bookings")
                .select("id", { head: true, count: "planned" })
                .eq("tenant_id", tId)
                .gte("starts_at", todayStart)
                .lte("starts_at", todayEnd),
              supabase
                .from("services")
                .select("id", { head: true, count: "planned" })
                .eq("tenant_id", tId)
                .eq("active", true),
              supabase
                .from("staff")
                .select("id", { head: true, count: "planned" })
                .eq("tenant_id", tId)
                .eq("active", true),
              supabase
                .from("bookings")
                .select(`
                  id,
                  starts_at,
                  ends_at,
                  status,
                  customer:customers(name, email),
                  service:services(name),
                  staff:staff(name)
                `)
                .eq("tenant_id", tId)
                .gte("starts_at", new Date().toISOString())
                .order("starts_at", { ascending: true })
                .limit(5),
            ]);

            return {
              tenant: { id: tId, name: "Tu barbería", timezone: "Europe/Madrid" },
              kpis: { bookingsToday: bookingsRes.count || 0, activeServices: servicesRes.count || 0, activeStaff: staffRes.count || 0 },
              upcomingBookings: upcomingRes.data || [],
            };
          });
        }

        if (hoveredItem === "/panel/clientes" && tId) {
          await doPrefetch(`customers-page-default`, async () => {
            const { data } = await supabase
              .from("customers")
              .select("*")
              .eq("tenant_id", tId)
              .order("created_at", { ascending: false })
              .limit(50);
            return { customers: data || [] };
          });
        }

        if (hoveredItem === "/panel/servicios" && tId) {
          await doPrefetch(`services-page-default`, async () => {
            const { data } = await supabase
              .from("services")
              .select("*")
              .eq("tenant_id", tId)
              .order("name", { ascending: true });

            // Importante: devolver misma forma que useServicesPageData
            // para que la página de Servicios reciba también tenant.id
            return {
              tenant: {
                id: tId,
                name: tenantName || "Tu barbería",
                timezone: "Europe/Madrid",
              },
              services: data || [],
            };
          });
        }

        if (hoveredItem === "/panel/staff" && tId) {
          await doPrefetch(`staff-page-default`, async () => {
            const { data } = await supabase
              .from("staff")
              .select(`*, bookings:bookings(count)`)
              .eq("tenant_id", tId)
              .order("name");
            return { staff: data || [] };
          });
        }

        if (hoveredItem === "/panel/chat" && tId) {
          await doPrefetch(`chat-page-${tId}`, async () => {
            // Prefetch optimizado para chat: conversaciones + miembros en paralelo
            const [conversationsResult, membersResult] = await Promise.all([
              supabase.rpc("get_user_conversations_optimized", {
                p_user_id: null, // Se resolverá en la RPC
                p_tenant_id: tId,
              }),
              supabase.rpc("list_tenant_members", { p_tenant_id: tId })
            ]);

            const conversations = conversationsResult.data || [];
            const members = membersResult.data || [];

            const membersDirectory: Record<string, any> = {};
            for (const member of members) {
              membersDirectory[member.user_id] = {
                userId: member.user_id,
                displayName: member.display_name,
                tenantRole: member.tenant_role,
                profilePhotoUrl: member.avatar_url || undefined,
              };
            }

            return {
              tenant: { id: tId, name: "Tu barbería", timezone: "Europe/Madrid" },
              conversations: conversations.map((conv: any) => ({
                id: conv.id,
                tenantId: conv.tenant_id,
                type: conv.type,
                name: conv.name,
                lastMessageBody: conv.last_message_body,
                lastMessageAt: conv.last_message_at,
                unreadCount: conv.unread_count || 0,
                membersCount: conv.members_count || 0,
                lastReadAt: conv.last_read_at,
                createdBy: conv.created_by,
                viewerRole: conv.viewer_role,
              })),
              membersDirectory,
            };
          });
        }
      } catch (err) {
        // ignore prefetch failures
      }
    }, 160) as any;

    return () => {
      if (prefetchTimeoutRef.current) {
        clearTimeout(prefetchTimeoutRef.current);
        prefetchTimeoutRef.current = null;
      }
    };
  }, [hoveredItem, router, tenantId]);

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
          "md:translate-x-0 h-screen md:h-full",
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
            className="space-y-3"
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
            {navigationItems.map((item, index) => {
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
                    prefetch={item.href !== "/logout"} // No prefetch logout
                    onClick={() => {
                      // Solo aplicar lógica especial para navegación normal, no para logout
                      if (item.href === "/logout") return;

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
                      "flex items-center rounded-[var(--radius-md)] text-sm font-medium font-satoshi transition-all duration-300 relative group overflow-hidden",
                      // Consistent padding for both states, only gap changes
                      isExpanded ? "gap-3 px-3 py-2.5" : "justify-center px-3 py-2.5",
                      active
                        ? "gradient-aurora-1 text-white shadow-[0px_4px_16px_rgba(123,92,255,0.4)] ring-1 ring-white/20"
                        : item.href === "/logout"
                        ? "text-red-400 hover:text-red-300 hover:bg-red-500/10 hover:shadow-[0px_2px_12px_rgba(239,68,68,0.1)]"
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
                        rotate: active ? -5 : 0,
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 25,
                        duration: 0.2
                      }}
                      className={cn(
                        "flex-shrink-0 relative z-10 flex items-center justify-center",
                        active ? "text-white drop-shadow-sm" : "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"
                      )}
                    >
                      {icon}
                      {/* Icon glow effect */}
                      {active && (
                        <motion.div
                          className="absolute inset-0 bg-white/30 rounded-full blur-sm"
                          animate={{
                            opacity: 0.5,
                            scale: 1.1
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
                    {/* Active indicator - only show when expanded */}
                    {active && isExpanded && (
                      <motion.div
                        layoutId="activeIndicator"
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white shadow-[0px_0px_12px_rgba(255,255,255,0.8)] ring-2 ring-white/30"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{
                          scale: 1,
                          opacity: 1
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 25,
                          duration: 0.3
                        }}
                      />
                    )}
                  </Link>
                </motion.li>
              );
            })}
          </motion.ul>
        </nav>

      </motion.aside>
    </>
  );
}