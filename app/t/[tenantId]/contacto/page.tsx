import Link from "next/link";
import { getPublicTenant } from "@/lib/tenant/public-api";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}): Promise<Metadata> {
  const { tenantId } = await params;
  const tenant = await getPublicTenant(tenantId);
  if (!tenant) return { title: "Contacto" };
  return { title: `Contacto — ${tenant.name}` };
}

export default async function ContactoPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const tenant = await getPublicTenant(tenantId);
  if (!tenant) notFound();

  const brand = tenant.primary_color || "#4FA1D8";
  const mapQuery = tenant.address
    ? encodeURIComponent(`${tenant.name}, ${tenant.address}`)
    : encodeURIComponent(tenant.name);

  return (
    <div className="px-4 pb-8 pt-4">
      <h1 className="text-xl font-bold text-white">Contacto</h1>
      <p className="mt-1 text-sm text-slate-500">Datos y ubicación de {tenant.name}</p>

      <div className="mt-6 space-y-4 rounded-2xl border border-[#1d2430] bg-[#0f131b] p-5 text-sm">
        {tenant.address && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dirección</p>
            <p className="mt-1 text-slate-200">{tenant.address}</p>
          </div>
        )}
        {tenant.contact_phone && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Teléfono</p>
            <a
              href={`tel:${tenant.contact_phone.replace(/\s/g, "")}`}
              className="mt-1 inline-block font-semibold"
              style={{ color: brand }}
            >
              {tenant.contact_phone}
            </a>
          </div>
        )}
        {tenant.contact_email && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</p>
            <a href={`mailto:${tenant.contact_email}`} className="mt-1 inline-block text-slate-200 underline">
              {tenant.contact_email}
            </a>
          </div>
        )}
        {!tenant.address && !tenant.contact_phone && !tenant.contact_email && (
          <p className="text-slate-500">
            El comercio aún no ha publicado los datos de contacto. Pregunta al local o vuelve más tarde.
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex flex-1 items-center justify-center rounded-2xl py-3 text-sm font-bold text-white"
          style={{ backgroundColor: brand }}
        >
          Abrir en mapas
        </a>
        <Link
          href="/servicios"
          className="inline-flex flex-1 items-center justify-center rounded-2xl border border-[#2a3344] py-3 text-sm font-semibold text-slate-200"
        >
          Reservar
        </Link>
      </div>
    </div>
  );
}
