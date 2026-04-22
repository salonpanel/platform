"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  businessName: string;
  logoUrl: string | null;
  brandColor: string;
  children: React.ReactNode;
};

export function TenantPublicShell({ businessName, logoUrl, brandColor, children }: Props) {
  const pathname = usePathname() || "/";
  const isHome = pathname === "/" || pathname === "";

  const navItem = (href: string, label: string, match: (p: string) => boolean) => {
    const active = match(pathname);
    return (
      <Link
        href={href}
        className="flex min-w-0 flex-col items-center gap-0.5 py-1.5 text-[8px] font-medium transition-colors sm:text-[9px]"
        style={{
          color: active ? brandColor : "#64748b",
        }}
        prefetch={true}
      >
        <span
          className="text-base leading-none"
          style={{ color: active ? brandColor : "#64748b" }}
          aria-hidden
        >
          {label === "Inicio" && "⌂"}
          {label === "Servicios" && "✂"}
          {label === "Galería" && "▣"}
          {label === "Contacto" && "✉"}
          {label === "Citas" && "◎"}
        </span>
        {label}
      </Link>
    );
  };

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header
        className="sticky top-0 z-40 border-b border-[#1d2430] bg-[#0a0d12]/90 backdrop-blur-md"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between gap-3 px-4">
          <Link href="/" className="flex min-w-0 items-center gap-2.5 no-underline">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                className="h-9 w-9 shrink-0 rounded-lg border border-[#1d2430] object-cover"
              />
            ) : (
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border font-bold text-sm text-white"
                style={{ backgroundColor: brandColor + "33", borderColor: brandColor + "55" }}
              >
                {businessName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-100">{businessName}</p>
              {isHome && <p className="truncate text-[11px] text-slate-500">Reserva en un clic</p>}
            </div>
          </Link>
          <Link
            href="/servicios"
            className="shrink-0 rounded-full px-3.5 py-2 text-xs font-bold text-white shadow-md transition hover:opacity-90"
            style={{ backgroundColor: brandColor, boxShadow: `0 4px 14px ${brandColor}55` }}
          >
            Reservar
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg flex-1">{children}</div>

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#1d2430] bg-[#0a0d12]/95 backdrop-blur-md"
        style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom, 0px))" }}
        role="navigation"
        aria-label="Navegación principal"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 items-stretch">
          {navItem("/", "Inicio", (p) => p === "/" || p === "")}
          {navItem("/servicios", "Servicios", (p) => p.startsWith("/servicios"))}
          {navItem("/galeria", "Galería", (p) => p.startsWith("/galeria"))}
          {navItem("/contacto", "Contacto", (p) => p.startsWith("/contacto"))}
          {navItem("/mis-citas", "Citas", (p) => p.startsWith("/mis-citas"))}
        </div>
      </nav>
    </div>
  );
}
