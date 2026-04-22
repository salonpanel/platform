import { notFound } from "next/navigation";
import { getPublicTenant } from "@/lib/tenant/public-api";
import type { Metadata } from "next";
import { TenantPublicShell } from "../components/TenantPublicShell";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}): Promise<Metadata> {
  const { tenantId } = await params;
  const tenant = await getPublicTenant(tenantId);
  if (!tenant) return { title: "BookFast" };
  const desc =
    [tenant.address, "Reservas online"].filter(Boolean).join(" · ") ||
    `Cita y servicios de ${tenant.name}.`;
  return {
    title: `${tenant.name} — Peluquería y barbería | Reservas online`,
    description: desc,
    robots: { index: true, follow: true },
  };
}

export default async function TenantPublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  // Portal público ON por defecto. Solo se desactiva explícitamente.
  const pwaEnabled = process.env.NEXT_PUBLIC_PWA_ENABLED !== "false";
  if (!pwaEnabled) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#05070a",
          color: "#f2f5fa",
        }}
      >
        <div style={{ textAlign: "center", padding: "24px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: 700, marginBottom: "12px" }}>
            Próximamente
          </h1>
          <p style={{ color: "#8898aa", fontSize: "15px" }}>
            El sistema de reservas online estará disponible muy pronto.
          </p>
        </div>
      </div>
    );
  }

  const tenant = await getPublicTenant(tenantId);
  if (!tenant) notFound();

  if (!tenant.is_active) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#05070a",
        }}
      >
        <div
          style={{
            textAlign: "center",
            maxWidth: "360px",
            padding: "32px",
            background: "#0f131b",
            border: "1px solid #1d2430",
            borderRadius: "20px",
          }}
        >
          <h1
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color: "#f2f5fa",
              marginBottom: "8px",
            }}
          >
            {tenant.name}
          </h1>
          <p style={{ color: "#8898aa", fontSize: "14px", lineHeight: 1.6 }}>
            Este negocio no está disponible momentáneamente. Por favor contacta directamente
            con el centro.
          </p>
        </div>
      </div>
    );
  }

  const settings: any = (tenant as any).settings || {};
  const brandColor =
    (tenant as any).primary_color || settings.brand_color || "#4FA1D8";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#05070a",
        color: "#f2f5fa",
        fontFamily: "var(--font-sans, 'Geist', system-ui, sans-serif)",
        "--tenant-brand": brandColor,
      } as React.CSSProperties}
    >
      <TenantPublicShell
        businessName={tenant.name}
        logoUrl={tenant.logo_url}
        brandColor={brandColor}
      >
        <div className="pb-24">{children}</div>
      </TenantPublicShell>
    </div>
  );
}

