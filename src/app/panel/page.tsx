"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getCurrentTenant } from "@/lib/panel-tenant";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";

function PanelHomeContent() {
  const supabase = createClientComponentClient();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    bookingsToday: 0,
    activeServices: 0,
    activeStaff: 0,
  });

  // Extraer el valor de impersonate una sola vez para evitar re-renders
  const impersonateOrgId = useMemo(() => {
    return searchParams?.get("impersonate") || null;
  }, [searchParams?.toString()]);

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      try {
        const { tenant: tenantData } = await getCurrentTenant(impersonateOrgId);

        if (tenantData && mounted) {
          // Cargar estadísticas básicas
          const today = new Date().toISOString().split("T")[0];
          const startOfDay = new Date(today).toISOString();
          const endOfDay = new Date(today + "T23:59:59").toISOString();

          // Bookings de hoy
          const { count: bookingsCount } = await supabase
            .from("bookings")
            .select("*", { count: "exact", head: true })
            .eq("tenant_id", tenantData.id)
            .gte("starts_at", startOfDay)
            .lt("starts_at", endOfDay);

          // Servicios activos
          const { count: servicesCount } = await supabase
            .from("services")
            .select("*", { count: "exact", head: true })
            .eq("tenant_id", tenantData.id)
            .eq("active", true);

          // Staff activo
          const { count: staffCount } = await supabase
            .from("staff")
            .select("*", { count: "exact", head: true })
            .eq("tenant_id", tenantData.id)
            .eq("active", true);

          if (mounted) {
            setStats({
              bookingsToday: bookingsCount || 0,
              activeServices: servicesCount || 0,
              activeStaff: staffCount || 0,
            });
            setLoading(false);
          }
        } else if (mounted) {
          setLoading(false);
        }
      } catch (err) {
        console.error("Error al cargar datos:", err);
        if (mounted) setLoading(false);
      }
    };

    loadData();
    
    return () => {
      mounted = false;
    };
  }, [impersonateOrgId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
        <p className="text-slate-400 mt-1">Bienvenido al panel de gestión</p>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400">Reservas hoy</p>
              <p className="text-2xl font-bold text-slate-100">{stats.bookingsToday}</p>
            </div>
            <div className="rounded-full bg-blue-600/20 p-3">
              <span className="text-2xl">📅</span>
            </div>
          </div>
          <Link
            href="/panel/agenda"
            className="mt-4 block text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Ver agenda →
          </Link>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400">Servicios activos</p>
              <p className="text-2xl font-bold text-slate-100">{stats.activeServices}</p>
            </div>
            <div className="rounded-full bg-emerald-600/20 p-3">
              <span className="text-2xl">✂️</span>
            </div>
          </div>
          <Link
            href="/panel/servicios"
            className="mt-4 block text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Gestionar servicios →
          </Link>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400">Staff activo</p>
              <p className="text-2xl font-bold text-slate-100">{stats.activeStaff}</p>
            </div>
            <div className="rounded-full bg-purple-600/20 p-3">
              <span className="text-2xl">👤</span>
            </div>
          </div>
          <Link
            href="/panel/staff"
            className="mt-4 block text-sm text-purple-400 hover:text-purple-300 transition-colors"
          >
            Gestionar staff →
          </Link>
        </Card>
      </div>

      {/* Accesos rápidos */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-slate-100">Accesos rápidos</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Link
            href="/panel/agenda"
            className="flex flex-col items-center rounded-lg border border-slate-800 p-4 text-center transition-colors hover:bg-slate-800/50"
          >
            <span className="text-3xl mb-2">📅</span>
            <span className="font-medium text-slate-100">Agenda</span>
            <span className="text-xs text-slate-400">Ver reservas</span>
          </Link>
          <Link
            href="/panel/clientes"
            className="flex flex-col items-center rounded-lg border border-slate-800 p-4 text-center transition-colors hover:bg-slate-800/50"
          >
            <span className="text-3xl mb-2">👥</span>
            <span className="font-medium text-slate-100">Clientes</span>
            <span className="text-xs text-slate-400">Gestionar clientes</span>
          </Link>
          <Link
            href="/panel/servicios"
            className="flex flex-col items-center rounded-lg border border-slate-800 p-4 text-center transition-colors hover:bg-slate-800/50"
          >
            <span className="text-3xl mb-2">✂️</span>
            <span className="font-medium text-slate-100">Servicios</span>
            <span className="text-xs text-slate-400">Gestionar servicios</span>
          </Link>
          <Link
            href="/panel/staff"
            className="flex flex-col items-center rounded-lg border border-slate-800 p-4 text-center transition-colors hover:bg-slate-800/50"
          >
            <span className="text-3xl mb-2">👤</span>
            <span className="font-medium text-slate-100">Staff</span>
            <span className="text-xs text-slate-400">Gestionar staff</span>
          </Link>
        </div>
      </Card>
    </div>
  );
}

export default function PanelHome() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      }
    >
      <PanelHomeContent />
    </Suspense>
  );
}

