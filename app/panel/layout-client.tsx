"use client";

import { ReactNode, useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SidebarNav } from "@/components/panel/SidebarNav";
import { MobileBottomNav } from "@/components/panel/MobileBottomNav";
import { TopBar } from "@/components/panel/TopBar";
import { ImpersonationBanner } from "@/components/panel/ImpersonationBanner";
import { PageContainer } from "@/components/panel/PageContainer";
import { Spinner } from "@/components/ui/Spinner";
import { ToastProvider } from "@/components/ui";
import { getCurrentTenant } from "@/lib/panel-tenant";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { NotificationProvider } from "@/components/agenda/NotificationSystem";
import { PermissionsProvider, usePermissions } from "@/contexts/PermissionsContext";
import { usePrefetchRoutes, useSmartPrefetchData } from "@/hooks/usePrefetch";
import { useServiceWorker } from "@/hooks/useServiceWorker";
import { useCacheWarmer } from "@/hooks/useCacheWarmer";
import { TenantProvider } from "@/contexts/TenantContext";

type TenantInfo = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
};

function PanelLayoutContent({
  children,
  initialTenant,
  initialAuthStatus,
  initialBootstrapState
}: {
  children: ReactNode;
  initialTenant?: TenantInfo | null;
  initialAuthStatus?: "UNKNOWN" | "AUTHENTICATED" | "UNAUTHENTICATED";
  initialBootstrapState?: "NO_MEMBERSHIP" | "NO_TENANT_SELECTED" | "AUTHENTICATED";
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tenant, setTenant] = useState<TenantInfo | null>(initialTenant ?? null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(initialTenant ? false : true);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [panelError, setPanelError] = useState<{ title: string; description?: string } | null>(null);
  const [noMembership, setNoMembership] = useState(false);
  const [authStatus, setAuthStatus] = useState<"UNKNOWN" | "AUTHENTICATED" | "UNAUTHENTICATED">(initialAuthStatus ?? "UNKNOWN");
  const [authRedirectTriggered, setAuthRedirectTriggered] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(initialAuthStatus ? initialAuthStatus === "UNKNOWN" : true);

  // Obtener el contexto de permisos para setear el tenantId
  const { setTenantId: setPermissionsTenantId } = usePermissions();

  // --------------------------------------------------------------------------
  // PHASE 9.2: BOOTSTRAP STATE ENFORCEMENT & LOOP PREVENTION
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!initialBootstrapState) return;

    // Rule 1: NO MEMBERSHIP
    if (initialBootstrapState === "NO_MEMBERSHIP") {
      if (pathname !== "/panel/sin-permisos") {
        console.log("[Bootstrap] Redirecting to /panel/sin-permisos");
        router.push("/panel/sin-permisos");
      }
      return;
    }

    // Rule 2: NO TENANT SELECTED (Multi-Tenant Switcher Needed)
    if (initialBootstrapState === "NO_TENANT_SELECTED") {
      if (pathname !== "/panel/select-business") {
        console.log("[Bootstrap] Redirecting to /panel/select-business");
        // FIX BUG 2: Use window.location for definitive redirect if stuck
        // preventing infinite loading if router.push fails or is blocked
        if (typeof window !== "undefined") {
          // We prefer router.replace normally, but to fix the "hang", we force it.
          // However, let's try router.replace first, it is SPA friendly.
          // If the user reports "dead", safe option is window.location for this specific bootstrap case.
          router.replace("/panel/select-business");
        }
      }
      return;
    }

    // Rule 3: AUTHENTICATED
    // Proceed as normal.
  }, [initialBootstrapState, pathname, router]);

  // Si estamos en estado de "Bootstrapping Exception" (No Membership / No Tenant), 
  // permitimos renderizar si el path coincide con la excepción.
  // Si no coincide, mostramos loading mientras el useEffect redirige.
  const isBootstrapException = initialBootstrapState === "NO_MEMBERSHIP" || initialBootstrapState === "NO_TENANT_SELECTED";

  if (initialBootstrapState === "NO_MEMBERSHIP") {
    if (pathname === "/panel/sin-permisos") {
      // Render children (the exception page) without sidebar
      return <div className="min-h-screen bg-slate-950">{children}</div>;
    }
    return <div className="flex min-h-screen items-center justify-center bg-slate-950"><Spinner /></div>;
  }

  if (initialBootstrapState === "NO_TENANT_SELECTED") {
    if (pathname === "/panel/select-business") {
      // Render children (the selection page) without sidebar
      return <div className="min-h-screen bg-slate-950">{children}</div>;
    }
    return <div className="flex min-h-screen items-center justify-center bg-slate-950"><Spinner /></div>;
  }

  // --------------------------------------------------------------------------
  // Hooks de precarga para navegación instantánea
  usePrefetchRoutes();
  useServiceWorker();

  // 🔥 CACHE WARMER: Mantiene datos frescos durante sesiones largas
  useCacheWarmer(tenant?.id || null);

  // Extraer el valor de impersonate una sola vez para evitar re-renders
  const impersonateOrgId = useMemo(() => {
    return searchParams?.get("impersonate") || null;
  }, [searchParams?.toString()]);

  // Prefetch inteligente: espera a que la página esté cargada y precarga herramientas críticas
  useSmartPrefetchData(tenant?.id || null, impersonateOrgId);

  // Cargar estado del sidebar desde localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sidebarCollapsed");
      if (saved !== null) {
        setSidebarCollapsed(saved === "true");
      }
    }
  }, []);

  // --------------------------------------------------------------------------
  // CLIENT PACIFICATION (Phase 14.4)
  // Trust the server. No initial session checks or timeouts on mount.
  // The Middleware and Server Layout have already validated the session.
  // --------------------------------------------------------------------------

  // Sync auth status from props if provided
  useEffect(() => {
    if (initialAuthStatus && initialAuthStatus !== "UNKNOWN") {
      setAuthStatus(initialAuthStatus);
      setSessionLoading(false);
    }
  }, [initialAuthStatus]);

  useEffect(() => {
    let mounted = true;
    const loadTenant = async () => {
      // 1. TRUST SERVER PROPS: If initialTenant exists, use it instantly.
      if (initialTenant) {
        setTenant(initialTenant);
        setPermissionsTenantId(initialTenant.id);
        setAuthStatus("AUTHENTICATED");
        setSessionLoading(false);
        setLoading(false);
        return;
      }

      // 2. IMPERSONATION EXCEPTION: If impersonating, we MUST fetch from client
      // (because server layout might not have handled impersonation logic)
      if (impersonateOrgId) {
        console.log("[PanelLayoutClient] Impersonation detected, fetching tenant...");
        setLoading(true);
        try {
          const result = await getCurrentTenant(impersonateOrgId);
          if (!mounted) return;

          if (result.tenant) {
            setTenant(result.tenant);
            setPermissionsTenantId(result.tenant.id);
          }
        } catch (e) {
          console.error("Impersonation fetch failed", e);
        } finally {
          if (mounted) setLoading(false);
        }
        return;
      }

      // 3. FALLBACK / ERROR STATE
      // If no initialTenant and no impersonation, we rely on bootstrapState from server.
      // We do NOT fetch getCurrentTenant() again.
      // Server should have set bootstrapState="NO_TENANT_SELECTED" or "NO_MEMBERSHIP"
      setSessionLoading(false);
      setLoading(false);

    };

    loadTenant();

    return () => {
      mounted = false;
    };
  }, [impersonateOrgId, initialTenant]);

  useEffect(() => {
    if (authStatus !== "UNAUTHENTICATED" || authRedirectTriggered) {
      return;
    }

    console.log("[PanelLayoutClient] Auth status is UNAUTHENTICATED, redirecting to login", {
      pathname,
      authStatus,
      authRedirectTriggered,
    });

    setAuthRedirectTriggered(true);
    const currentPath = pathname || "/panel";
    router.push(`/login?redirect=${encodeURIComponent(currentPath)}`);
  }, [authStatus, authRedirectTriggered, pathname, router]);

  const handleExitImpersonation = async () => {
    try {
      const response = await fetch("/api/admin/tenants/exit-impersonate", {
        method: "POST",
      });

      if (response.ok) {
        router.push("/admin/tenants");
      } else {
        console.error("Error al salir de impersonación");
      }
    } catch (err) {
      console.error("Error al salir de impersonación:", err);
    }
  };

  const handleToggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const newState = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("sidebarCollapsed", newState.toString());
      }
      return newState;
    });
  };

  // Mostrar loading mientras se verifica la sesión o se carga el tenant
  if (sessionLoading || loading || authStatus === "UNKNOWN") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-slate-400">
            {sessionLoading ? "Verificando sesión..." : "Cargando panel..."}
          </p>
        </div>
      </div>
    );
  }

  if (authStatus === "UNAUTHENTICATED") {
    return null; // El useEffect ya redirige
  }

  if (noMembership) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-center max-w-md mx-auto p-6">
          <h1 className="text-2xl font-bold text-white mb-4">Sin acceso</h1>
          <p className="text-slate-400 mb-6">
            No tienes acceso a ninguna barbería. Contacta con soporte para obtener acceso.
          </p>
        </div>
      </div>
    );
  }

  if (panelError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-center max-w-md mx-auto p-6">
          <h1 className="text-2xl font-bold text-white mb-4">{panelError.title}</h1>
          {panelError.description && (
            <p className="text-slate-400 mb-6">{panelError.description}</p>
          )}
        </div>
      </div>
    );
  }

  if (!tenant) {
    if (!loading) {
      console.warn("[PanelLayoutClient] Valid session BUT no tenant and not loading. Force redirect to select-business.");
      // This prevents infinite loading loop
      // We use window.location for hard redirect as fallback
      if (typeof window !== "undefined") {
        window.location.href = "/panel/select-business";
      }
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950">
          <Spinner size="lg" />
          <p className="mt-4 text-slate-400">Redirigiendo...</p>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-slate-400">Cargando barbería...</p>
        </div>
      </div>
    );
  }

  const navItems = [
    { href: "/panel", label: "Dashboard" },
    { href: "/panel/agenda", label: "Agenda" },
    { href: "/panel/clientes", label: "Clientes" },
    { href: "/panel/servicios", label: "Servicios" },
    { href: "/panel/staff", label: "Staff" },
    { href: "/panel/monedero", label: "Monedero" },
    { href: "/panel/marketing", label: "Marketing" },
    { href: "/panel/chat", label: "Chat" },
    { href: "/panel/ajustes", label: "Ajustes" },
  ];

  const getPageTitle = () => {
    if (pathname === "/panel") return "Dashboard";
    if (pathname === "/panel/agenda") return "Agenda";
    if (pathname === "/panel/clientes") return "Clientes";
    if (pathname === "/panel/servicios") return "Servicios";
    if (pathname === "/panel/staff") return "Staff";
    if (pathname === "/panel/monedero") return "Monedero";
    if (pathname === "/panel/marketing") return "Marketing";
    if (pathname === "/panel/chat") return "Chat";
    if (pathname === "/panel/ajustes") return "Ajustes";
    return "Panel";
  };

  return (
    <div className="flex h-screen bg-slate-950">
      {/* Sidebar - Hidden on mobile */}
      <div className="hidden md:block h-full">
        <SidebarNav
          items={navItems}
          tenantName={tenant.name}
          isOpen={sidebarOpen}
          isCollapsed={sidebarCollapsed}
          onClose={() => setSidebarOpen(false)}
          onToggleCollapse={handleToggleSidebar}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Impersonation Banner */}
        {isImpersonating && (
          <ImpersonationBanner
            tenantName={tenant.name}
            onEndImpersonation={handleExitImpersonation}
          />
        )}

        {/* Top Bar */}
        <TopBar
          title={getPageTitle()}
          tenantName={tenant.name}
          userRole={userRole}
          timezone={tenant.timezone}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          sidebarCollapsed={sidebarCollapsed}
        />

        {/* Page Content - Add bottom padding on mobile for bottom nav */}
        <main className="flex-1 overflow-y-auto bg-slate-950 pb-16 md:pb-0">
          <TenantProvider tenant={tenant} isLoading={loading}>
            <PageContainer>{children}</PageContainer>
          </TenantProvider>
        </main>
      </div>

      {/* Mobile Bottom Navigation - Only visible on mobile */}
      <MobileBottomNav items={navItems} />
    </div>
  );
}

// Update Props Interface
type PanelLayoutClientProps = {
  children: ReactNode;
  initialTenant?: TenantInfo | null;
  initialAuthStatus?: "UNKNOWN" | "AUTHENTICATED" | "UNAUTHENTICATED";
  initialPermissions?: any;
  initialRole?: string | null;
  initialBootstrapState?: "NO_MEMBERSHIP" | "NO_TENANT_SELECTED" | "AUTHENTICATED";
};

export default function PanelLayoutClient({
  children,
  initialTenant,
  initialAuthStatus,
  initialPermissions,
  initialRole,
  initialBootstrapState = "AUTHENTICATED"
}: PanelLayoutClientProps) {
  return (
    <ToastProvider>
      <NotificationProvider>
        <PermissionsProvider initialPermissions={initialPermissions} initialRole={initialRole} initialTenantId={initialTenant?.id}>
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
            <PanelLayoutContent
              initialTenant={initialTenant}
              initialAuthStatus={initialAuthStatus}
              initialBootstrapState={initialBootstrapState}
            >
              {children}
            </PanelLayoutContent>
          </Suspense>
        </PermissionsProvider>
      </NotificationProvider>
    </ToastProvider>
  );
}

