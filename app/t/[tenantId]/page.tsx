import Link from "next/link";
import { getPublicTenant } from "@/lib/tenant/public-api";
import { notFound } from "next/navigation";

export default async function TenantHomePage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tenant = await getPublicTenant(tenantId);
  if (!tenant) notFound();

  const brand = (tenant as any).primary_color || (tenant as any).settings?.brand_color || "#4FA1D8";

  return (
    <main
      style={{
        maxWidth: "440px",
        margin: "0 auto",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          position: "relative",
          minHeight: "240px",
          display: "flex",
          alignItems: "flex-end",
          padding: "28px 24px",
          background: "linear-gradient(160deg, #0f131b 0%, #05070a 100%)",
          borderBottom: "1px solid #1d2430",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: "300px",
            height: "300px",
            right: "-80px",
            top: "-80px",
            background: `radial-gradient(circle, ${brand}33, transparent 70%)`,
            filter: "blur(40px)",
            pointerEvents: "none",
          }}
        />

        {(tenant as any).logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={(tenant as any).logo_url}
            alt={tenant.name}
            style={{
              position: "absolute",
              top: "24px",
              left: "24px",
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              objectFit: "cover",
              border: "1px solid #1d2430",
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              top: "24px",
              left: "24px",
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: brand + "22",
              border: `1px solid ${brand}44`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
              fontWeight: 700,
              color: brand,
            }}
          >
            {tenant.name.charAt(0).toUpperCase()}
          </div>
        )}

        <div style={{ position: "relative", zIndex: 2 }}>
          <h1
            style={{
              fontSize: "28px",
              fontWeight: 800,
              color: "#f2f5fa",
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
              margin: "0 0 6px",
            }}
          >
            {tenant.name}
          </h1>
          <p style={{ fontSize: "14px", color: "#8898aa", margin: 0 }}>
            Reserva tu cita online
          </p>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <Link
          href="/servicios"
          style={{
            display: "block",
            width: "100%",
            textAlign: "center",
            padding: "16px",
            borderRadius: "14px",
            background: brand,
            color: "#fff",
            fontWeight: 700,
            fontSize: "16px",
            textDecoration: "none",
            boxShadow: `0 8px 24px ${brand}44`,
            transition: "opacity 0.15s",
          }}
        >
          Reservar ahora
        </Link>

        <Link
          href="/servicios"
          style={{
            display: "block",
            width: "100%",
            textAlign: "center",
            padding: "16px",
            borderRadius: "14px",
            background: "#0f131b",
            border: "1px solid #1d2430",
            color: "#c9d6e3",
            fontWeight: 600,
            fontSize: "15px",
            textDecoration: "none",
            transition: "border-color 0.15s",
          }}
        >
          Ver servicios y precios
        </Link>

        <div
          style={{
            marginTop: "12px",
            padding: "20px",
            background: "#0f131b",
            border: "1px solid #1d2430",
            borderRadius: "16px",
          }}
        >
          <h3
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "#8898aa",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              margin: "0 0 8px",
            }}
          >
            Bienvenido
          </h3>
          <p style={{ fontSize: "14px", color: "#c9d6e3", lineHeight: 1.6, margin: 0 }}>
            Usa esta app para reservar tu cita en{" "}
            <strong style={{ color: "#f2f5fa" }}>{tenant.name}</strong> de forma rápida y sencilla.
          </p>
        </div>
      </div>

      <footer
        style={{
          padding: "20px 24px",
          textAlign: "center",
          borderTop: "1px solid #1d2430",
          fontSize: "12px",
          color: "#4a5568",
        }}
      >
        Reservas gestionadas por <strong style={{ color: "#8898aa" }}>BookFast</strong>
      </footer>
    </main>
  );
}

