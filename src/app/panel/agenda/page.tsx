'use client';

import { useEffect, useMemo, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { endOfDay, startOfDay } from "date-fns";

type Appt = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: "hold" | "confirmed" | "cancelled" | "noshow";
  customer_id: string | null;
  service_id: string | null;
  staff_id: string | null;
  org_id: string;
};

export default function AgendaPage() {
  const supabase = createClientComponentClient();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [rows, setRows] = useState<Appt[]>([]);
  const [tenantTimezone, setTenantTimezone] = useState<string>("Europe/Madrid"); // P1.2: Timezone del tenant
  
  // P1.2: Formateador de tiempo usando timezone del tenant
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("es-ES", {
        timeZone: tenantTimezone,
        hour: "2-digit",
        minute: "2-digit",
      }),
    [tenantTimezone]
  );

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("default_org_id")
        .eq("user_id", user.id)
        .single();

      const org = profile?.default_org_id;
      setOrgId(org ?? null);
      if (!org) {
        setLoaded(true);
        return;
      }

      // P1.2: Obtener timezone del tenant
      const { data: tenantData } = await supabase
        .from("tenants")
        .select("id, timezone")
        .eq("id", org)
        .maybeSingle();

      if (tenantData?.timezone) {
        setTenantTimezone(tenantData.timezone);
      }

      const from = startOfDay(new Date()).toISOString();
      const to = endOfDay(new Date()).toISOString();

      const { data } = await supabase
        .from("appointments")
        .select("*")
        .eq("org_id", org)
        .gte("starts_at", from)
        .lt("starts_at", to)
        .order("starts_at", { ascending: true });

      if (mounted) {
        setRows((data as Appt[]) || []);
        setLoaded(true);
      }

      const channel = supabase
        .channel("rt-appointments")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "appointments",
            filter: `org_id=eq.${org}`,
          },
          (payload) => {
            setRows((prev) => {
              if (payload.eventType === "INSERT") {
                return [...prev, payload.new as Appt].sort((a, b) =>
                  a.starts_at.localeCompare(b.starts_at)
                );
              }
              if (payload.eventType === "UPDATE") {
                return prev.map((r) =>
                  r.id === payload.new.id ? (payload.new as Appt) : r
                );
              }
              if (payload.eventType === "DELETE") {
                return prev.filter((r) => r.id !== payload.old.id);
              }
              return prev;
            });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    const cleanupPromise = load();

    return () => {
      mounted = false;
      cleanupPromise.then((cleanup) => {
        if (typeof cleanup === "function") cleanup();
      });
    };
  }, [supabase]);

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold mb-3">Agenda de hoy</h2>
      {!loaded && (
        <div className="p-3 text-sm text-gray-500">Cargando agenda…</div>
      )}
      {loaded && !orgId && (
        <div className="p-3 text-sm text-gray-500">
          No tienes una organización por defecto asignada.
        </div>
      )}
      <div className="border rounded divide-y">
        {rows.map((r) => (
          <div key={r.id} className="p-3 flex items-center justify-between">
            <div>
              <div className="font-medium">
                {timeFormatter.format(new Date(r.starts_at))} —{" "}
                {timeFormatter.format(new Date(r.ends_at))}
              </div>
              <div className="text-sm text-gray-600">{r.status}</div>
            </div>
            <div className="flex gap-2">
              {/* acciones rápidas */}
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="p-3 text-sm text-gray-500">Sin citas hoy.</div>
        )}
      </div>
    </div>
  );
}

