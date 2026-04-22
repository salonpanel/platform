import Link from "next/link";
import {
  getPublicTenant,
  getPublicServices,
  getPublicStaffMembers,
} from "@/lib/tenant/public-api";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

function formatPriceEur(cents: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(
    cents / 100
  );
}

export default async function TenantHomePage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tenant = await getPublicTenant(tenantId);
  if (!tenant) notFound();

  const brand = tenant.primary_color || "#4FA1D8";
  const [services, staff] = await Promise.all([
    getPublicServices(tenant.id),
    getPublicStaffMembers(tenant.id),
  ]);

  const preview = services.slice(0, 4);
  const galleryImgs = services
    .map((s) => s.image_url)
    .filter((u): u is string => Boolean(u))
    .slice(0, 6);

  const aboutText = tenant.address
    ? `Estamos en ${tenant.address}. Atención personalizada, horarios que se adaptan a ti y un equipo apasionado por el buen corte.`
    : `En ${tenant.name} cuidamos tu imagen con mimo: cortes, barba y asesoramiento para que salgas como quieres. Pide cita en segundos.`;

  const mapQuery = tenant.address
    ? encodeURIComponent(`${tenant.name}, ${tenant.address}`)
    : encodeURIComponent(tenant.name);

  return (
    <main className="text-slate-200">
      {/* Hero */}
      <section
        id="inicio"
        className="relative scroll-mt-20 border-b border-[#1d2430] bg-gradient-to-b from-[#0f131b] to-[#05070a] px-4 pb-10 pt-6"
      >
        <div
          className="pointer-events-none absolute right-0 top-0 h-64 w-64 -translate-y-1/4 translate-x-1/4 rounded-full opacity-40 blur-3xl"
          style={{ background: `radial-gradient(circle, ${brand}55, transparent 65%)` }}
        />
        <div className="relative z-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          Peluquería & barbería
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight text-white">
          {tenant.name}
        </h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">
          Web oficial: conoce al equipo, el salón y reserva tu cita cuando te venga bien.
        </p>
        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <Link
            href="/servicios"
            className="inline-flex items-center justify-center rounded-2xl px-5 py-3.5 text-sm font-bold text-white shadow-lg transition hover:opacity-95"
            style={{ backgroundColor: brand, boxShadow: `0 8px 28px ${brand}44` }}
          >
            Reservar cita
          </Link>
          <a
            href="#nosotros"
            className="inline-flex items-center justify-center rounded-2xl border border-[#2a3344] bg-[#0f131b] px-5 py-3.5 text-sm font-semibold text-slate-200 hover:border-slate-600"
          >
            Conocernos
          </a>
        </div>
        </div>
      </section>

      {/* Sobre / Por qué nosotros */}
      <section id="nosotros" className="scroll-mt-20 border-b border-[#1d2430] px-4 py-10">
        <h2 className="text-lg font-bold text-white">Sobre el salón</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">{aboutText}</p>
        <ul className="mt-6 space-y-3 text-sm text-slate-300">
          <li className="flex gap-2">
            <span style={{ color: brand }}>✓</span>
            Productos y técnicas pensadas para tu tipo de cabello y estilo.
          </li>
          <li className="flex gap-2">
            <span style={{ color: brand }}>✓</span>
            Proceso claro: eliges servicio, día y franja, sin colas al teléfono.
          </li>
          <li className="flex gap-2">
            <span style={{ color: brand }}>✓</span>
            Entorno cuidado y equipo coordinado con la agenda al instante.
          </li>
        </ul>
      </section>

      {/* Servicios (preview) */}
      <section id="servicios" className="scroll-mt-20 border-b border-[#1d2430] bg-[#080a0e] px-4 py-10">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">Servicios y precios</h2>
            <p className="mt-1 text-sm text-slate-500">Lo más reservado</p>
          </div>
          <Link href="/servicios" className="shrink-0 text-sm font-semibold hover:underline" style={{ color: brand }}>
            Ver todo
          </Link>
        </div>
        {preview.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500">Pronto publicaremos la carta de servicios.</p>
        ) : (
          <ul className="mt-5 space-y-2.5">
            {preview.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/reservar?service_id=${s.id}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[#1d2430] bg-[#0f131b] px-4 py-3.5 transition hover:border-slate-600"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-100">{s.name}</p>
                    <p className="text-xs text-slate-500">{s.duration_min} min</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-white">{formatPriceEur(s.price_cents)}</p>
                    <p className="text-[11px] font-medium" style={{ color: brand }}>
                      Reservar
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Equipo */}
      <section id="equipo" className="scroll-mt-20 border-b border-[#1d2430] px-4 py-10">
        <h2 className="text-lg font-bold text-white">Equipo</h2>
        <p className="mt-1 text-sm text-slate-500">Profesionales que te atienden con la misma cita online.</p>
        {staff.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Información del equipo disponible en el salón.</p>
        ) : (
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-2">
            {staff.map((m) => (
              <li
                key={m.id}
                className="overflow-hidden rounded-2xl border border-[#1d2430] bg-[#0f131b] p-3"
              >
                <div className="flex flex-col items-center text-center">
                  {m.profile_photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.profile_photo_url}
                      alt=""
                      className="h-16 w-16 rounded-full border border-[#1d2430] object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-16 w-16 items-center justify-center rounded-full border text-lg font-bold text-white"
                      style={{ backgroundColor: brand + "22", borderColor: brand + "44" }}
                    >
                      {m.display_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <p className="mt-2 text-sm font-semibold text-slate-100">{m.display_name}</p>
                  {m.bio && <p className="mt-1 line-clamp-3 text-xs text-slate-500">{m.bio}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Galería (preview) */}
      <section id="galeria" className="scroll-mt-20 border-b border-[#1d2430] bg-[#080a0e] px-4 py-10">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">Galería</h2>
            <p className="mt-1 text-sm text-slate-500">Un vistazo al resultado</p>
          </div>
          <Link href="/galeria" className="text-sm font-semibold hover:underline" style={{ color: brand }}>
            Ver más
          </Link>
        </div>
        {galleryImgs.length === 0 && !tenant.logo_url ? (
          <p className="mt-4 text-sm text-slate-500">
            Pronto añadiremos fotos del local y trabajos. Mientras, reserva y ven a conocernos.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[tenant.logo_url, ...galleryImgs]
              .filter((u, i, a) => u && a.indexOf(u) === i)
              .slice(0, 6)
              .map((url, i) => (
                <div
                  key={`${url}-${i}`}
                  className="aspect-[4/3] overflow-hidden rounded-xl border border-[#1d2430] bg-[#0f131b]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url!} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
          </div>
        )}
      </section>

      {/* Contacto */}
      <section id="contacto" className="scroll-mt-20 px-4 py-10">
        <h2 className="text-lg font-bold text-white">Dónde estamos y contacto</h2>
        <p className="mt-1 text-sm text-slate-500">Llama, escríbenos o pásate — también puedes reservar online.</p>
        <ul className="mt-4 space-y-2 text-sm">
          {tenant.address && (
            <li>
              <span className="text-slate-500">Dirección: </span>
              <span className="text-slate-200">{tenant.address}</span>
            </li>
          )}
          {tenant.contact_phone && (
            <li>
              <a href={`tel:${tenant.contact_phone.replace(/\s/g, "")}`} className="font-medium" style={{ color: brand }}>
                {tenant.contact_phone}
              </a>
            </li>
          )}
          {tenant.contact_email && (
            <li>
              <a href={`mailto:${tenant.contact_email}`} className="font-medium text-slate-300 hover:underline">
                {tenant.contact_email}
              </a>
            </li>
          )}
        </ul>
        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex flex-1 items-center justify-center rounded-2xl border border-[#2a3344] py-3 text-sm font-semibold text-slate-200 hover:border-slate-500"
          >
            Cómo llegar
          </a>
          <Link
            href="/contacto"
            className="inline-flex flex-1 items-center justify-center rounded-2xl border border-transparent py-3 text-sm font-bold text-white"
            style={{ backgroundColor: brand }}
          >
            Ficha de contacto
          </Link>
        </div>
      </section>

      {/* CTA final */}
      <section className="border-t border-[#1d2430] bg-gradient-to-b from-[#0f131b] to-[#05070a] px-4 py-12 text-center">
        <h2 className="text-xl font-bold text-white">¿Listo para tu próxima cita?</h2>
        <p className="mt-2 text-sm text-slate-400">Elige servicio, día y hora. Recibirás la confirmación por email.</p>
        <Link
          href="/servicios"
          className="mt-6 inline-flex rounded-2xl px-8 py-3.5 text-sm font-bold text-white"
          style={{ backgroundColor: brand, boxShadow: `0 8px 24px ${brand}44` }}
        >
          Reservar ahora
        </Link>
        <p className="mt-6 text-xs text-slate-600">
          Reservas con tecnología <span className="text-slate-500">BookFast</span>
        </p>
      </section>
    </main>
  );
}
