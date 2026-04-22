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
  Target,
  Sparkles
} from "lucide-react";
import { usePermissions } from "@/contexts/PermissionsContext";

interface NavItem {
  href: string;
  label: string;
  icon?: string | null;
}

interface FeaturedNavItem {
  href: string;
  label: string;
  description?: string;
}

interface SidebarNavProps {
  items: NavItem[];
  tenantName: string;
  tenantTimezone?: string;
  isOpen?: boolean;
  isCollapsed?: boolean;
  onClose?: () => void;
  onToggleCollapse?: () => void;
  autoCollapseOnClick?: boolean;
  /** Entrada destacada que aparece al final del menú, antes del logout */
  featuredItem?: FeaturedNavItem;
}

export function SidebarNav({
  items,
  tenantName,
  tenantTimezone = "Europe/Madrid",
  isOpen = true,
  isCollapsed = false,
  onClose,
  onToggleCollapse,
  autoCollapseOnClick = true,
  featuredItem,
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
    // Si es owner/manager, mostrar todo
    if (role === "owner" || role === "admin" || role === "manager") {
      return items;
    }

    return items.filter((item) => {
      const permissionKey = routePermissionMap[item.href];
      if (!permissionKey) return true; // Si no está mapeado, mostrar por defecto
      return permissions[permissionKey]; // Mostrar solo si tiene permiso
    });
  }, [items, permissions, role]);

  // Items normales de navegación (el logout se renderiza por separado al final
  // para permitir que el featuredItem se sitúe entre la nav principal y el logout)
  const navigationItems = useMemo(() => filteredItems, [filteredItems]);

  const logoutItem: NavItem = useMemo(
    () => ({ href: "/logout", label: "Cerrar sesión", icon: "logout" }),
    []
  );

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
              tenant: { id: tId, name: tenantName || "Tu negocio", timezone: tenantTimezone },
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
                name: tenantName || "Tu negocio",
                timezone: tenantTimezone,
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
              tenant: { id: tId, name: tenantName || "Tu negocio", timezone: tenantTimezone },
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
          className="fixed inset-0 bg-black/70 backdrop-blur-md z-[52] md:hidden"
          onClick={onClose}
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
          "fixed md:static inset-y-0 left-0 z-[56] flex flex-col transition-all duration-300 ease-out",
          "bg-[var(--bf-bg-elev)] border-r border-[var(--bf-border)] sidebar-no-shadow",
          "md:translate-x-0 h-screen md:h-full",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
        style={{
          borderRadius: "0 var(--r-xl) var(--r-xl) 0",
        }}
      >
        {/* Logo/Name y botón toggle */}
        <div className="flex h-16 items-center justify-between border-b border-[var(--bf-border)] px-5 relative">
          <AnimatePresence mode="wait">
            {isExpanded ? (
              <motion.h1
                key="title"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="text-base font-semibold text-[var(--bf-ink-50)] truncate tracking-tight whitespace-nowrap"
              style={{ fontFamily: "var(--font-sans)" }}
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
                className="h-8 w-8 rounded-full bg-[var(--bf-primary)] flex items-center justify-center text-xs font-semibold text-[var(--bf-ink)] flex-shrink-0"
              >
                {tenantName.charAt(0).toUpperCase()}
              </motion.div>
            )}
          </AnimatePresence>


          {/* Botón cerrar (solo visible en mobile) */}
          <button
            onClick={onClose}
            className="md:hidden text-[var(--bf-ink-400)] hover:text-[var(--bf-ink-50)] p-1.5 rounded-[var(--r-sm)] hover:bg-[var(--bf-bg-elev)] transition-all duration-200"
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
                      "flex items-center rounded-[var(--r-md)] text-sm font-medium transition-all duration-300 relative group overflow-hidden",
                      isExpanded ? "gap-3 px-3 py-2.5" : "justify-center px-3 py-2.5",
                      active
                        ? "bg-[rgba(79,161,216,0.12)] text-[var(--bf-primary)] border border-[rgba(79,161,216,0.3)]"
                        : item.href === "/logout"
                        ? "text-[var(--bf-danger)] hover:text-[#F2A0AC] hover:bg-[rgba(224,96,114,0.10)]"
                        : "text-[var(--bf-ink-400)] hover:text-[var(--bf-ink-50)] hover:bg-[var(--bf-surface)]"
                    )}
                    style={{ fontFamily: "var(--font-sans)" }}
                    style={{
                      borderRadius: "var(--radius-md)",
                      minHeight: "44px",
                    }}
                    title={!isExpanded ? item.label : undefined}
                  >
                    {/* Hover highlight */}
                    {isItemHovered && !active && (
                      <motion.div
                        className="absolute inset-0 bg-[rgba(79,161,216,0.07)] rounded-[var(--r-md)]"
                        layoutId="ripple"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
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
                        active ? "text-[var(--bf-primary)]" : "text-[var(--bf-ink-400)] group-hover:text-[var(--bf-ink-100)]"
                      )}
                    >
                      {icon}
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
                    {/* Active indicator */}
                    {active && isExpanded && (
                      <motion.div
                        layoutId="activeIndicator"
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[var(--bf-primary)] shadow-[0_0_8px_rgba(79,161,216,0.6)]"
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

          {/* Featured item (BookFast AI) — destacado al final del nav, antes del logout */}
          {featuredItem && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="mt-6 mb-3"
            >
              <Link
                href={featuredItem.href}
                prefetch
                onClick={() => {
                  if (typeof window !== "undefined" && window.innerWidth < 768) {
                    if (onClose) onClose();
                  } else if (autoCollapseOnClick && !isCollapsed && onToggleCollapse) {
                    setTimeout(() => {
                      onToggleCollapse();
                      if (typeof window !== "undefined") {
                        localStorage.setItem("sidebarCollapsed", "true");
                      }
                    }, 150);
                  }
                }}
                className={cn(
                  "group relative flex items-center rounded-[var(--r-md)] overflow-hidden",
                  "transition-all duration-300",
                  isExpanded ? "gap-3 px-3 py-3" : "justify-center px-3 py-3",
                  isActive(featuredItem.href)
                    ? "bg-[var(--bf-primary)] text-[var(--bf-ink)] shadow-[var(--bf-shadow-glow)]"
                    : "bg-[rgba(79,161,216,0.10)] text-[var(--bf-ink-100)] border border-[rgba(79,161,216,0.25)] hover:bg-[rgba(79,161,216,0.18)] hover:border-[rgba(79,161,216,0.4)]"
                )}
                style={{
                  borderRadius: "var(--radius-md)",
                  minHeight: "48px",
                }}
                title={!isExpanded ? featuredItem.label : undefined}
              >
                <span
                  className="relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--r-md)] bg-[var(--bf-primary)] shadow-[var(--bf-shadow-glow)]"
                >
                  <Sparkles className="h-4 w-4 text-[var(--bf-ink)]" />
                </span>

                <AnimatePresence mode="wait">
                  {isExpanded && (
                    <motion.div
                      key="featured-label"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.25 }}
                      className="relative z-10 flex flex-col min-w-0"
                    >
                          <span
                            className="text-sm font-semibold tracking-tight truncate"
                            style={{ fontFamily: "var(--font-sans)" }}
                          >
                            {featuredItem.label}
                          </span>
                          {featuredItem.description && (
                            <span
                              className="text-[11px] text-[var(--bf-ink-400)] truncate"
                              style={{ fontFamily: "var(--font-sans)" }}
                            >
                              {featuredItem.description}
                            </span>
                          )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </Link>
            </motion.div>
          )}

          {/* Logout — siempre al final del nav */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.3 }}
            className="mt-2"
          >
            <Link
              href={logoutItem.href}
              prefetch={false}
              className={cn(
                "flex items-center rounded-[var(--r-md)] text-sm font-medium transition-all duration-300 relative group overflow-hidden",
                isExpanded ? "gap-3 px-3 py-2.5" : "justify-center px-3 py-2.5",
                "text-[var(--bf-danger)] hover:text-[#F2A0AC] hover:bg-[rgba(224,96,114,0.10)]"
              )}
              style={{ fontFamily: "var(--font-sans)" }}
              style={{
                borderRadius: "var(--radius-md)",
                minHeight: "44px",
              }}
              title={!isExpanded ? logoutItem.label : undefined}
            >
              <span className="flex-shrink-0 relative z-10 flex items-center justify-center text-[var(--bf-danger)] group-hover:text-[#F2A0AC]">
                <LogOut className="h-5 w-5" />
              </span>
              <AnimatePresence mode="wait">
                {isExpanded && (
                  <motion.span
                    key="logout-label"
                    initial={{ opacity: 0, width: 0, x: -10 }}
                    animate={{ opacity: 1, width: "auto", x: 0 }}
                    exit={{ opacity: 0, width: 0, x: -10 }}
                    transition={{ duration: 0.25 }}
                    className="flex-1 truncate whitespace-nowrap relative z-10"
                  >
                    {logoutItem.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          </motion.div>
        </nav>

      </motion.aside>
    </>
  );
}