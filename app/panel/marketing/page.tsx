"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { getCurrentTenant } from "@/lib/panel-tenant";
import { GlassCard, GlassButton } from "@/components/ui/glass";
import { Loader2, Megaphone, Users, Calendar, TrendingUp } from "lucide-react";
import { ProtectedRoute } from "@/components/panel/ProtectedRoute";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

function MarketingContent() {
  const supabase = getSupabaseBrowser();
  const searchParams = useSearchParams();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const impersonateOrgId = useMemo(() => searchParams?.get("impersonate") || null, [searchParams?.toString()]);

  useEffect(() => {
    const loadTenant = async () => {
      try {
        setLoading(true);
        const { tenant } = await getCurrentTenant(impersonateOrgId);

        if (tenant) {
          setTenantId(tenant.id);
        }
      } catch (err: any) {
        console.error("Error al cargar tenant:", err);
      } finally {
        setLoading(false);
      }
    };

    loadTenant();
  }, [impersonateOrgId]);

  // Métricas ficticias para demo
  const metrics = {
    inactiveCustomers: 40,
    bookingsGenerated: 12,
    revenueAttributable: 325.0,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-accent)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Card principal */}
      <GlassCard className="p-6">
        <div className="flex items-start gap-4 mb-6">
          <div className="h-12 w-12 rounded-lg bg-[var(--color-accent)]/20 flex items-center justify-center">
            <Megaphone className="h-6 w-6 text-[var(--color-accent)]" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white">Campañas de Marketing</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Recupera clientes inactivos y llena los huecos libres de tu agenda
            </p>
          </div>
        </div>

        {/* Mini panel de métricas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 rounded-lg border border-white/10 bg-white/5">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-5 w-5 text-[var(--text-secondary)]" />
              <span className="text-sm font-medium text-[var(--text-primary)]">Clientes inactivos</span>
            </div>
            <div className="text-2xl font-bold text-white">{metrics.inactiveCustomers}</div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">A invitar</div>
          </div>

          <div className="p-4 rounded-lg border border-white/10 bg-white/5">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-5 w-5 text-[var(--text-secondary)]" />
              <span className="text-sm font-medium text-[var(--text-primary)]">Citas generadas</span>
            </div>
            <div className="text-2xl font-bold text-white">{metrics.bookingsGenerated}</div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">Este mes</div>
          </div>

          <div className="p-4 rounded-lg border border-white/10 bg-white/5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-5 w-5 text-[var(--text-secondary)]" />
              <span className="text-sm font-medium text-[var(--text-primary)]">Ingresos atribuibles</span>
            </div>
            <div className="text-2xl font-bold text-white">{metrics.revenueAttributable.toFixed(2)} €</div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">Este mes</div>
          </div>
        </div>

        {/* Botón de acción */}
        <GlassButton className="w-full md:w-auto">
          Ver campañas
        </GlassButton>
      </GlassCard>

      {/* Placeholder para futuras funcionalidades */}
      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold text-white mb-2">Próximamente</h3>
        <p className="text-sm text-[var(--text-secondary)]">
          Estamos trabajando en herramientas avanzadas de marketing automatizado para ayudarte a:
        </p>
        <ul className="mt-4 space-y-2 text-sm text-[var(--text-secondary)]">
          <li className="flex items-start gap-2">
            <span className="text-[var(--color-accent)]">•</span>
            <span>Enviar recordatorios automáticos a clientes</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--color-accent)]">•</span>
            <span>Recuperar clientes inactivos con ofertas personalizadas</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--color-accent)]">•</span>
            <span>Llenar huecos libres con promociones de última hora</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--color-accent)]">•</span>
            <span>Programar campañas de email marketing</span>
          </li>
        </ul>
      </GlassCard>
    </div>
  );
}

export default function MarketingPage() {
  return (
    <ProtectedRoute requiredPermission="marketing">
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--color-accent)]" />
          </div>
        }
      >
        <MarketingContent />
      </Suspense>
    </ProtectedRoute>
  );
}






