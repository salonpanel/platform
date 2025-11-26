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
import { BookingModalProvider } from "@/contexts/BookingModalContext";
import { BookingCreateModal } from "@/modules/bookings/BookingCreateModal";
import { BookingDetailModal } from "@/modules/bookings/BookingDetailModal";

type TenantInfo = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
};

function PanelLayoutContent({ children, initialTenant, initialAuthStatus }: { children: ReactNode; initialTenant?: TenantInfo | null; initialAuthStatus?: "UNKNOWN" | "AUTHENTICATED" | "UNAUTHENTICATED" }) {
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

  // Verificar sesión inicial antes de cargar el tenant
  useEffect(() => {
    // Si ya tenemos authStatus proporcionado por el servidor, no hacemos la comprobación client-side
    if (initialAuthStatus && initialAuthStatus !== "UNKNOWN") {
      setSessionLoading(false);
      setAuthStatus(initialAuthStatus);
      return;
    }

    let mounted = true;
    const checkSession = async () => {
      try {
        const supabase = getSupabaseBrowser();
        const { data: { session }, error } = await supabase.auth.getSession();

        if (!mounted) return;

        // Manejar errores de sesión
        if (error) {
          console.warn("[PanelLayoutClient] Session error:", error);
          if (error.message?.toLowerCase().includes("jwt does not exist") ||
              error.message?.toLowerCase().includes("invalid jwt")) {
            // JWT inválido - limpiar cookies y marcar como no autenticado
            console.log("[PanelLayoutClient] JWT inválido detectado en verificación inicial, limpiando");
            await supabase.auth.signOut({ scope: 'local' });
            setAuthStatus("UNAUTHENTICATED");
            setSessionLoading(false);
            return;
          }
        }

        if (!session) {
          setAuthStatus("UNAUTHENTICATED");
          setSessionLoading(false);
          return;
        }

        setAuthStatus("AUTHENTICATED");
        setSessionLoading(false);
      } catch (err) {
        console.error("[PanelLayoutClient] Error checking session:", err);
        if (mounted) {
          setAuthStatus("UNAUTHENTICATED");
          setSessionLoading(false);
        }
      }
    };

    checkSession();
    return () => {
      mounted = false;
    };
  }, [initialAuthStatus]);

  useEffect(() => {
    let mounted = true;
    const loadTenant = async () => {
      // Si tenemos initialTenant del servidor, usarlo directamente
      if (initialTenant && initialAuthStatus === "AUTHENTICATED") {
        setTenant(initialTenant);
        setPermissionsTenantId(initialTenant.id);
        setAuthStatus("AUTHENTICATED");
        setSessionLoading(false);
        setLoading(false);
        return;
      }

      // Esperar a que la sesión esté verificada antes de cargar el tenant
      if (sessionLoading || authStatus === "UNKNOWN") {
        return;
      }

      if (authStatus === "UNAUTHENTICATED") {
        setLoading(false);
        return;
      }
      setLoading(true);
      setPanelError(null);
      setNoMembership(false);

      // If initial tenant has been provided server-side, skip fetching again and set permissions
      if (initialTenant && authStatus === "AUTHENTICATED") {
        setTenant(initialTenant);
        setPermissionsTenantId(initialTenant.id);
        setLoading(false);
        return;
      }

      try {
        const result = await getCurrentTenant(impersonateOrgId);

        if (!mounted) {
          return;
        }

        if (result.status === "UNAUTHENTICATED") {
          setAuthStatus("UNAUTHENTICATED");
          setTenant(null);
          setUserRole(null);
          setIsImpersonating(false);
          setLoading(false);
          return;
        }

        setAuthStatus("AUTHENTICATED");

        if (result.status === "NO_MEMBERSHIP") {
          setTenant(null);
          setUserRole(null);
          setIsImpersonating(false);
          setNoMembership(true);
          setLoading(false);
          return;
        }

        if (result.status === "ERROR") {
          setTenant(null);
          setUserRole(null);
          setIsImpersonating(false);
          setPanelError({
            title: "Error al cargar la barbería",
            description:
              result.error?.message ||
              "No pudimos cargar la información de tu cuenta. Inténtalo de nuevo en unos minutos.",
          });
          setLoading(false);
          return;
        }

        if (result.tenant) {
          setTenant(result.tenant);
          setUserRole(result.role);
          setIsImpersonating(result.isImpersonating);
          // Setear el tenantId en el contexto de permisos para que se carguen una sola vez
          setPermissionsTenantId(result.tenant.id);
        } else {
          // Caso defensivo: status OK pero sin tenant
          setPanelError({
            title: "No se pudo encontrar tu barbería",
            description: "Contacta con soporte para revisar la configuración de tu cuenta.",
          });
        }
      } catch (err: any) {
        console.error("[PanelLayout] Error cargando tenant:", err);

        if (!mounted) {
          return;
        }

        if (err?.message && err.message.toLowerCase().includes("auth session missing")) {
          setAuthStatus("UNAUTHENTICATED");
        } else if (err?.message && err.message.toLowerCase().includes("jwt does not exist")) {
          // Sesión JWT inválida - limpiar y redirigir
          console.log("[PanelLayout] JWT inválido detectado, limpiando sesión");
          const supabase = getSupabaseBrowser();
          await supabase.auth.signOut({ scope: 'local' });
          setAuthStatus("UNAUTHENTICATED");
        } else {
          setPanelError({
            title: "Error al cargar la barbería",
            description: err?.message || "Error inesperado al obtener los datos del tenant.",
          });
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadTenant();

    return () => {
      mounted = false;
    };
  }, [impersonateOrgId, sessionLoading, authStatus, initialTenant, initialAuthStatus]);

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
      <BookingModalProvider>
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
            <PageContainer>{children}</PageContainer>
          </main>
        </div>

        {/* Mobile Bottom Navigation - Only visible on mobile */}
        <MobileBottomNav items={navItems} />

        {/* Booking Modals */}
        <BookingCreateModal />
        <BookingDetailModal />
      </BookingModalProvider>
    </div>
  );
}

export default function PanelLayoutClient({ children, initialTenant, initialAuthStatus, initialPermissions, initialRole }: { children: ReactNode; initialTenant?: TenantInfo | null; initialAuthStatus?: "UNKNOWN" | "AUTHENTICATED" | "UNAUTHENTICATED"; initialPermissions?: any; initialRole?: string | null }) {
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
            <PanelLayoutContent initialTenant={initialTenant} initialAuthStatus={initialAuthStatus}>{children}</PanelLayoutContent>
          </Suspense>
        </PermissionsProvider>
      </NotificationProvider>
    </ToastProvider>
  );
}

