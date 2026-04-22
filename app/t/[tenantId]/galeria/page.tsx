import Link from "next/link";
import { getPublicServices, getPublicTenant } from "@/lib/tenant/public-api";
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
  if (!tenant) return { title: "Galería" };
  return { title: `Galería — ${tenant.name}` };
}

export default async function GaleriaPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const tenant = await getPublicTenant(tenantId);
  if (!tenant) notFound();

  const services = await getPublicServices(tenant.id);
  const brand = tenant.primary_color || "#4FA1D8";
  const imgs = [
    tenant.logo_url,
    ...services.map((s) => s.image_url).filter((u): u is string => Boolean(u)),
  ].filter((u, i, a) => u && a.indexOf(u) === i);

  return (
    <div className="px-4 pb-8 pt-4">
      <h1 className="text-xl font-bold text-white">Galería</h1>
      <p className="mt-1 text-sm text-slate-500">Imágenes del local y de los servicios ofrecidos.</p>

      {imgs.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-[#2a3344] bg-[#0f131b] p-8 text-center">
          <p className="text-sm text-slate-500">
            Pronto habrá fotos publicadas. Puedes reservar ya y conocer el salón en persona.
          </p>
          <Link
            href="/servicios"
            className="mt-4 inline-block rounded-2xl px-6 py-3 text-sm font-bold text-white"
            style={{ backgroundColor: brand }}
          >
            Ver servicios
          </Link>
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {imgs.map((url, i) => (
            <li key={i} className="aspect-square overflow-hidden rounded-xl border border-[#1d2430] bg-[#0a0c10]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url!} alt="" className="h-full w-full object-cover" />
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-center text-xs text-slate-600">
        ¿Eres el negocio? Sube imágenes de servicios (con URL) desde el panel para enriquecer esta galería.
      </p>
    </div>
  );
}
