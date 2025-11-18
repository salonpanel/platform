"use client";

import { ReactNode, useEffect, useState, Suspense, useMemo } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { SidebarNav } from "@/components/panel/SidebarNav";
import { TopBar } from "@/components/panel/TopBar";
import { ImpersonationBanner } from "@/components/panel/ImpersonationBanner";
import { PageContainer } from "@/components/panel/PageContainer";
import { Spinner } from "@/components/ui/Spinner";
import { motion } from "framer-motion";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

type TenantInfo = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
};

function PanelLayoutContent({ children }: { children: ReactNode }) {
  const supabase = getSupabaseBrowser();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  // Cargar estado de sidebar desde localStorage
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tenantError, setTenantError] = useState<any>(null);
  const [membershipError, setMembershipError] = useState<any>(null);

  // Cargar estado de sidebar desde localStorage después del mount
  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sidebarCollapsed");
      if (saved === "true") {
        setSidebarCollapsed(true);
      }
      // Detectar si es desktop
      setIsDesktop(window.innerWidth >= 768);
      
      // Listener para cambios de tamaño
      const handleResize = () => {
        setIsDesktop(window.innerWidth >= 768);
      };
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  // Extraer el valor de impersonate una sola vez para evitar re-renders
  const impersonateOrgId = useMemo(() => {
    return searchParams?.get("impersonate") || null;
  }, [searchParams?.toString()]);

  useEffect(() => {
    let mounted = true;
    const loadTenant = async () => {
      try {
        console.log("[PanelLayout] Iniciando carga de tenant");

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          console.error("[PanelLayout] Error al obtener usuario:", userError);
          if (mounted) {
            setLoading(false);
            console.log("[PanelLayout] Marcando loading=false (error usuario)");
          }
          return;
        }

        if (!user) {
          console.warn("[PanelLayout] No hay usuario autenticado");
          if (mounted) {
            setLoading(false);
            console.log("[PanelLayout] Marcando loading=false (sin usuario)");
          }
          return;
        }

        console.log("[PanelLayout] Usuario autenticado:", { id: user.id, email: user.email });

        let targetTenantId: string | null = null;

        if (impersonateOrgId) {
          console.log("[PanelLayout] Verificando impersonación para:", impersonateOrgId);
          const { data: isAdmin, error: adminError } = await supabase.rpc("check_platform_admin", {
            p_user_id: user.id,
          });

          if (adminError) {
            console.error("[PanelLayout] Error check_platform_admin:", adminError);
          }

          if (isAdmin) {
            targetTenantId = impersonateOrgId;
            if (mounted) setIsImpersonating(true);
            console.log("[PanelLayout] Impersonación activada");
          } else {
            console.warn("[PanelLayout] Usuario no es platform admin, ignorando impersonación");
          }
        }

        // Si no hay impersonación, obtener tenant del usuario desde memberships
        if (!targetTenantId) {
          console.log("[PanelLayout] Buscando membership para usuario:", user.id);
          const { data: membership, error: membershipError } = await supabase
            .from("memberships")
            .select("tenant_id, role")
            .eq("user_id", user.id)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();

          if (membershipError) {
            console.error("[PanelLayout] Error cargando membership:", membershipError);
            console.error("[PanelLayout] Detalles completos:", JSON.stringify({
              user_id: user.id,
              email: user.email,
              error_code: membershipError.code,
              error_message: membershipError.message,
              error_details: membershipError.details,
              error_hint: membershipError.hint,
            }, null, 2));
            if (mounted) {
              setMembershipError(membershipError);
              setLoading(false);
              console.log("[PanelLayout] Marcando loading=false (error membership)");
            }
            return;
          }

          console.log("[PanelLayout] Membership encontrado:", membership);
          if (membership) {
            targetTenantId = membership.tenant_id;
            if (mounted) setUserRole(membership.role);
            console.log("[PanelLayout] Membership válido:", { tenant_id: targetTenantId, role: membership.role });
          } else {
            console.warn("[PanelLayout] No se encontró membership para el usuario:", {
              user_id: user.id,
              email: user.email,
            });
            if (mounted) {
              setLoading(false);
              console.log("[PanelLayout] Marcando loading=false (sin membership)");
            }
            return;
          }
        }

        if (!targetTenantId) {
          console.warn("[PanelLayout] No hay targetTenantId, deteniendo carga");
          if (mounted) {
            setLoading(false);
            console.log("[PanelLayout] Marcando loading=false (sin targetTenantId)");
          }
          return;
        }

        // Cargar información del tenant
        console.log("[PanelLayout] Cargando información del tenant:", targetTenantId);
        const { data: tenantData, error: tenantError } = await supabase
          .from("tenants")
          .select("id, name, slug, timezone")
          .eq("id", targetTenantId)
          .maybeSingle();

        if (tenantError) {
          console.error("[PanelLayout] Error al cargar tenant:", tenantError);
          console.error("[PanelLayout] Detalles completos del error:", JSON.stringify({
            targetTenantId,
            error_code: tenantError.code,
            error_message: tenantError.message,
            error_details: tenantError.details,
            error_hint: tenantError.hint,
          }, null, 2));
          if (mounted) {
            setTenantError(tenantError);
            setLoading(false);
            console.log("[PanelLayout] Marcando loading=false (error tenant)");
          }
          return;
        }

        console.log("[PanelLayout] Tenant cargado:", tenantData);
        if (tenantData && mounted) {
          setTenant({
            id: tenantData.id,
            name: tenantData.name,
            slug: tenantData.slug,
            timezone: tenantData.timezone || "Europe/Madrid",
          });
          setLoading(false);
          console.log("[PanelLayout] Marcando loading=false (tenant cargado)");
        } else {
          console.error("[PanelLayout] No se encontró tenant con ID:", targetTenantId);
          console.error("[PanelLayout] Esto puede deberse a:");
          console.error("  1. El tenant no existe en la base de datos");
          console.error("  2. El usuario no tiene permisos para ver el tenant (RLS)");
          console.error("  3. El membership apunta a un tenant que fue eliminado");
          if (mounted) {
            setLoading(false);
            console.log("[PanelLayout] Marcando loading=false (tenant no encontrado)");
          }
        }
      } catch (err) {
        console.error("[PanelLayout] Error general:", err);
        if (mounted) {
          setLoading(false);
          console.log("[PanelLayout] Marcando loading=false (catch)");
        }
      } finally {
        if (mounted) {
          console.log("[PanelLayout] Fin loadTenant, loading=false");
        }
      }
    };

    loadTenant();

    return () => {
      mounted = false;
    };
  }, [impersonateOrgId, supabase]);

  const handleExitImpersonation = async () => {
    const searchParams = new URLSearchParams(window.location.search);
    const orgId = searchParams.get("impersonate");
    if (orgId) {
      try {
        const response = await fetch(`/api/admin/tenants/${orgId}/impersonate`, {
          method: "DELETE",
        });
        if (response.ok) {
          window.location.href = "/admin";
        } else {
          const data = await response.json();
          alert(data.error || "Error al terminar impersonación");
        }
      } catch (err) {
        console.error("Error:", err);
        alert("Error al terminar impersonación");
      }
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--color-bg-base)" }}>
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-slate-400">Cargando panel...</p>
        </div>
      </div>
    );
  }

  if (!loading && !tenant) {
    // Verificar si hubo un error al cargar el tenant o membership (error 500, RLS, etc.)
    // vs simplemente no tener membership
    const hasError = tenantError !== null || membershipError !== null;
    
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--color-bg-base)" }}>
        <div className="text-center text-[var(--color-text-primary)] max-w-md px-4">
          {hasError ? (
            <>
              <p className="text-lg font-medium mb-2 text-amber-400">
                Error de conexión con el servidor
              </p>
              <p className="mt-2 text-sm text-slate-400 mb-4">
                No se pudo cargar la información de tu barbería. Esto puede deberse a un problema con las políticas RLS de tenants.
              </p>
              <p className="text-xs text-slate-500 mb-6">
                Revisa la consola del navegador (F12) para ver los detalles del error.
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-medium mb-2">No tienes ninguna barbería asignada.</p>
              <p className="mt-2 text-sm text-slate-400 mb-6">
                Contacta con soporte para que te asignen a un tenant o revisa tu invitación.
              </p>
            </>
          )}
          <Link
            href="/logout"
            className="inline-block rounded bg-slate-800 px-4 py-2 text-sm text-slate-100 hover:bg-slate-700 transition-colors"
          >
            Cerrar sesión
          </Link>
        </div>
      </div>
    );
  }

  const navItems = [
    { href: "/panel", label: "Dashboard", icon: null },
    { href: "/panel/agenda", label: "Agenda", icon: null },
    { href: "/panel/clientes", label: "Clientes", icon: null },
    { href: "/panel/servicios", label: "Servicios", icon: null },
    { href: "/panel/staff", label: "Staff", icon: null },
    { href: "/panel/chat", label: "Chats", icon: null },
    { href: "/panel/ajustes", label: "Ajustes", icon: null },
  ];

  const filteredNavItems = navItems.filter((item) => {
    if (!userRole) return true;
    const isAdmin = userRole === "owner" || userRole === "admin";
    if (item.href === "/panel/staff" || item.href === "/panel/ajustes") {
      return isAdmin;
    }
    return true;
  });

  const getPageTitle = () => {
    if (pathname === "/panel" || pathname === "/panel/") return "Dashboard";
    if (pathname === "/panel/agenda") return "Agenda";
    if (pathname === "/panel/clientes") return "Clientes";
    if (pathname === "/panel/servicios") return "Servicios";
    if (pathname === "/panel/staff") return "Staff";
    if (pathname === "/panel/chat") return "Chats";
    if (pathname === "/panel/ajustes") return "Ajustes";
    return "Panel";
  };

  return (
    <div className="flex h-screen" style={{ background: "var(--bg-primary)" }}>
      {/* Sidebar */}
      <SidebarNav
        items={filteredNavItems}
        tenantName={tenant?.name || ""}
        isOpen={sidebarOpen}
        isCollapsed={sidebarCollapsed}
        onClose={() => {
          setSidebarOpen(false);
          // En mobile, al cerrar, resetear el estado colapsado
          if (!isDesktop) {
            setSidebarCollapsed(false);
          }
        }}
        onToggleCollapse={() => {
          const newState = !sidebarCollapsed;
          setSidebarCollapsed(newState);
          // Guardar en localStorage
          if (typeof window !== "undefined") {
            localStorage.setItem("sidebarCollapsed", String(newState));
          }
        }}
        autoCollapseOnClick={true}
      />

      {/* Main Content */}
      <motion.div 
        className="flex-1 flex flex-col min-w-0 overflow-hidden"
        initial={false}
        animate={{
          marginLeft: isMounted && isDesktop
            ? (sidebarCollapsed ? 64 : 240)
            : 0,
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        {/* Impersonation Banner */}
        {isImpersonating && tenant && (
          <ImpersonationBanner
            tenantName={tenant.name}
            onEndImpersonation={handleExitImpersonation}
          />
        )}

        {/* Top Bar */}
        <TopBar
          title={getPageTitle()}
          tenantName={tenant?.name || ""}
          userRole={userRole}
          timezone={tenant?.timezone || "Europe/Madrid"}
          onMenuClick={() => {
          setSidebarOpen(!sidebarOpen);
          // En mobile, si se abre la sidebar, asegurar que no esté colapsada
          if (!sidebarOpen && !isDesktop) {
            setSidebarCollapsed(false);
          }
        }}
          sidebarCollapsed={sidebarCollapsed}
        />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto relative scrollbar-hide" style={{ background: "var(--bg-primary)" }}>
          <div className="h-full pt-4 md:pt-6">
            <PageContainer sidebarCollapsed={sidebarCollapsed}>{children}</PageContainer>
          </div>
        </main>
      </motion.div>
    </div>
  );
}

export default function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950">
          <div className="text-center">
            <Spinner size="lg" />
            <p className="mt-4 text-slate-400">Cargando panel...</p>
          </div>
        </div>
      }
    >
      <PanelLayoutContent>{children}</PanelLayoutContent>
    </Suspense>
  );
}
