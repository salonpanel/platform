"use client";

import { ReactNode, useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SidebarNav } from "@/components/panel/SidebarNav";
import { TopBar } from "@/components/panel/TopBar";
import { BottomNavBar } from "@/components/panel/BottomNavBar";
import { ImpersonationBanner } from "@/components/panel/ImpersonationBanner";
import { PageContainer } from "@/components/panel/PageContainer";
import { Spinner } from "@/components/ui/Spinner";
import { ToastProvider } from "@/components/ui";
import { getCurrentTenant } from "@/lib/panel-tenant";
import { MobileHamburgerButton } from "@/components/panel/MobileHamburgerButton";

type TenantInfo = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
};

function PanelLayoutContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Inicializar con el valor de localStorage si está disponible (solo en cliente)
  // Por defecto, empezar colapsado (true) para ahorrar espacio
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("sidebarCollapsed");
        // Si hay un valor guardado, usarlo; si no, empezar colapsado por defecto
        return saved !== null ? saved === "true" : true;
      } catch {
        return true; // Por defecto colapsado
      }
    }
    return true; // Por defecto colapsado en SSR
  });
  const [panelError, setPanelError] = useState<{ title: string; description?: string } | null>(null);
  const [noMembership, setNoMembership] = useState(false);
  const [authStatus, setAuthStatus] = useState<"UNKNOWN" | "AUTHENTICATED" | "UNAUTHENTICATED">("UNKNOWN");
  const [authRedirectTriggered, setAuthRedirectTriggered] = useState(false);

  // Extraer el valor de impersonate una sola vez para evitar re-renders
  const impersonateOrgId = useMemo(() => {
    return searchParams?.get("impersonate") || null;
  }, [searchParams?.toString()]);

  useEffect(() => {
    let mounted = true;
    const loadTenant = async () => {
      setLoading(true);
      setPanelError(null);
      setNoMembership(false);

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
  }, [impersonateOrgId]);

  useEffect(() => {
    if (authStatus !== "UNAUTHENTICATED" || authRedirectTriggered) {
      return;
    }

    setAuthRedirectTriggered(true);

    if (typeof window !== "undefined") {
      const currentUrl = `${window.location.pathname}${window.location.search}`;
      const redirectParam = encodeURIComponent(currentUrl || "/panel");
      router.replace(`/login?redirect=${redirectParam}`);
    }
  }, [authStatus, authRedirectTriggered, router]);

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
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4" style={{ color: "var(--text-secondary)" }}>Cargando panel...</p>
        </div>
      </div>
    );
  }

  if (!loading && authStatus === "UNAUTHENTICATED") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4" style={{ color: "var(--text-secondary)" }}>Redirigiendo al login...</p>
        </div>
      </div>
    );
  }

  if (!loading && panelError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-center max-w-md px-4" style={{ color: "var(--text-primary)" }}>
          <p className="text-lg font-medium mb-2">{panelError.title}</p>
          {panelError.description && (
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>{panelError.description}</p>
          )}
          <Link
            href="/logout"
            className="inline-block rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            style={{
              backgroundColor: "var(--bg-card)",
              color: "var(--text-primary)",
            }}
          >
            Cerrar sesión
          </Link>
        </div>
      </div>
    );
  }

  if (!loading && noMembership) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-center max-w-md px-4" style={{ color: "var(--text-primary)" }}>
          <h1 className="mb-2 text-xl font-semibold">No tienes ninguna barbería asignada.</h1>
          <p className="mb-4" style={{ color: "var(--text-secondary)" }}>
            Contacta con soporte o con tu administrador para que te asignen una barbería en la plataforma.
          </p>
          <Link
            href="/logout"
            className="inline-block rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            style={{
              backgroundColor: "var(--accent-blue)",
              color: "var(--text-primary)",
            }}
          >
            Cerrar sesión
          </Link>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return null;
  }

  const navItems = [
    { href: "/panel/agenda", label: "Agenda", icon: "📅" },
    { href: "/panel/clientes", label: "Clientes", icon: "👥" },
    { href: "/panel/servicios", label: "Servicios", icon: "✂️" },
    { href: "/panel/staff", label: "Staff", icon: "👤" },
    { href: "/panel/ajustes", label: "Ajustes", icon: "⚙️" },
  ];

  const getPageTitle = () => {
    if (pathname === "/panel/agenda") return "Agenda";
    if (pathname === "/panel/clientes") return "Clientes";
    if (pathname === "/panel/servicios") return "Servicios";
    if (pathname === "/panel/staff") return "Staff";
    if (pathname === "/panel/ajustes") return "Ajustes";
    return "Panel";
  };

  // Determinar densidad para data-density attribute
  const [density, setDensity] = useState<"normal" | "compact" | "ultra-compact">("normal");

  useEffect(() => {
    const updateDensity = () => {
      const height = window.innerHeight;
      if (height <= 750) {
        setDensity("ultra-compact");
      } else if (height <= 950) {
        setDensity("compact");
      } else {
        setDensity("normal");
      }
    };

    updateDensity();
    window.addEventListener("resize", updateDensity);
    return () => window.removeEventListener("resize", updateDensity);
  }, []);

  return (
    <div 
      className="flex h-screen overflow-hidden bg-[var(--bg-primary)]"
      data-density={density}
    >
      {/* Sidebar - Scroll interno propio si supera altura disponible */}
      <SidebarNav
        items={navItems}
        tenantName={tenant.name}
        isOpen={sidebarOpen}
        isCollapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapse={() => {
          setSidebarCollapsed((prev) => {
            const newState = !prev;
            if (typeof window !== "undefined") {
              localStorage.setItem("sidebarCollapsed", newState ? "true" : "false");
            }
            return newState;
          });
        }}
      />

      {/* Main Content - ZERO SCROLL: flex-col, sin scroll vertical */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
        {/* Impersonation Banner - Fijo, no afecta contenedor principal */}
        {isImpersonating && (
          <div className="flex-shrink-0">
            <ImpersonationBanner
              tenantName={tenant.name}
              onEndImpersonation={handleExitImpersonation}
            />
          </div>
        )}

        {/* Top Bar - Fijo, sin afectar contenedor principal */}
        <div className="flex-shrink-0">
          <TopBar
            title={getPageTitle()}
            tenantName={tenant.name}
            userRole={userRole}
            timezone={tenant.timezone}
            onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          />
        </div>

        {/* Page Content - ZERO SCROLL: flex-1 min-h-0 overflow-hidden relative */}
        <main className="flex-1 min-h-0 overflow-hidden relative bg-[var(--bg-primary)]">
          <PageContainer>{children}</PageContainer>
        </main>

        {/* Bottom Navigation Bar - Solo visible en móvil */}
        <BottomNavBar />
      </div>

      {/* Mobile Hamburger Button - Flotante en esquina inferior derecha */}
      <MobileHamburgerButton onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
    </div>
  );
}

export default function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)]">
            <div className="text-center">
              <Spinner size="lg" />
              <p className="mt-4" style={{ color: "var(--text-secondary)" }}>Cargando panel...</p>
            </div>
          </div>
        }
      >
        <PanelLayoutContent>{children}</PanelLayoutContent>
      </Suspense>
    </ToastProvider>
  );
}
