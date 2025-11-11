'use client';

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type Service = {
  id: string;
  name: string;
  duration_min: number;
  price_cents: number;
  active: boolean;
  org_id: string;
  stripe_price_id: string | null;
  stripe_product_id: string | null;
};

export default function ServicesPage() {
  const supabase = createClientComponentClient();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [items, setItems] = useState<Service[]>([]);
  const [form, setForm] = useState({
    name: "",
    duration_min: 30,
    price_cents: 1500,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("default_org_id")
        .eq("user_id", user.id)
        .single();

      const org = profile?.default_org_id ?? null;
      if (mounted) {
        setOrgId(org);
      }

      if (!org) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("services")
        .select("*")
        .eq("org_id", org)
        .order("name");

      if (mounted) {
        setItems((data as Service[]) || []);
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  const create = async () => {
    if (!orgId || saving) return;
    setError(null);
    setSaving(true);
    try {
      const response = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: orgId,
          name: form.name,
          duration_min: form.duration_min,
          price_cents: form.price_cents,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "No se pudo crear el servicio.");
      }

      setItems((prev) => [...prev, data as Service]);
      setForm({
        name: "",
        duration_min: 30,
        price_cents: 1500,
      });
    } catch (err: any) {
      setError(err?.message ?? "Error desconocido.");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (id: string, active: boolean) => {
    setError(null);
    try {
      const response = await fetch(`/api/services/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "No se pudo actualizar el servicio.");
      }
      setItems((prev) =>
        prev.map((item) => (item.id === id ? (data as Service) : item))
      );
    } catch (err: any) {
      setError(err?.message ?? "Error desconocido.");
    }
  };

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-lg font-semibold">Servicios</h2>
      {!orgId && loading && (
        <div className="text-sm text-gray-500">Cargando servicios…</div>
      )}
      {!orgId && !loading && (
        <div className="text-sm text-gray-500">
          No tienes una organización por defecto asignada.
        </div>
      )}
      {orgId && (
        <>
          <div className="flex flex-wrap gap-2">
            <input
              className="border p-2 rounded flex-1 min-w-40"
              placeholder="Nombre"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className="border p-2 rounded w-28"
              type="number"
              min={5}
              value={form.duration_min}
              onChange={(e) =>
                setForm({ ...form, duration_min: Number(e.target.value) })
              }
            />
            <input
              className="border p-2 rounded w-28"
              type="number"
              min={0}
              value={form.price_cents}
              onChange={(e) =>
                setForm({ ...form, price_cents: Number(e.target.value) })
              }
            />
            <button
              onClick={create}
              className="rounded bg-black text-white px-4 py-2"
              disabled={saving || !form.name.trim()}
            >
              {saving ? "Guardando…" : "Añadir"}
            </button>
          </div>
          <div className="border rounded divide-y">
            {items.map((service) => (
              <div
                key={service.id}
                className="p-3 flex justify-between items-center"
              >
                <div>
                  <div className="font-medium">{service.name}</div>
                  <div className="text-sm text-gray-600">
                    {service.duration_min} min ·{" "}
                    {(service.price_cents / 100).toFixed(2)} €
                  </div>
                  {service.stripe_price_id && (
                    <div className="text-xs text-gray-500">
                      Price ID: {service.stripe_price_id}
                    </div>
                  )}
                  {service.stripe_product_id && (
                    <div className="text-xs text-gray-500">
                      Product ID: {service.stripe_product_id}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => toggle(service.id, service.active)}
                  className="text-sm underline"
                >
                  {service.active ? "Desactivar" : "Activar"}
                </button>
              </div>
            ))}
            {items.length === 0 && (
              <div className="p-3 text-sm text-gray-500">Sin servicios.</div>
            )}
          </div>
          {error && (
            <div className="rounded border border-red-500 bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}
        </>
      )}
    </div>
  );
}

