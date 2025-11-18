import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export const runtime = "nodejs";

/**
 * GET /api/panel/customers/export
 * Exporta clientes a CSV según los filtros aplicados
 *
 * Query params:
 * - activity: "all" | "active90" | "inactive90"
 * - segment: "all" | "vip" | "banned" | "marketing" | "no_contact"
 * - order: "recent" | "value"
 * - visitFilter: "all" | "with" | "without"
 * - search: término de búsqueda (opcional)
 * - impersonate: tenant ID para impersonación (opcional)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const activityFilter = searchParams.get("activity") || "all";
    const segmentFilter = searchParams.get("segment") || "all";
    const sortOption = searchParams.get("order") || "recent";
    const visitFilter = searchParams.get("visitFilter") || "all";
    const searchTerm = searchParams.get("search") || "";
    const impersonateOrgId = searchParams.get("impersonate");

    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Obtener tenant
    let tenantId: string | null = null;

    if (impersonateOrgId) {
      // Verificar si es platform admin
      const { data: isAdmin } = await supabase.rpc("check_platform_admin", {
        p_user_id: session.user.id,
      });
      if (isAdmin) {
        tenantId = impersonateOrgId;
      }
    }

    if (!tenantId) {
      // Obtener membership del usuario
      const { data: membership, error: membershipError } = await supabase
        .from("memberships")
        .select("tenant_id")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (membershipError || !membership) {
        return NextResponse.json(
          { error: "No tienes acceso a ninguna barbería" },
          { status: 403 }
        );
      }

      tenantId = membership.tenant_id;
    }

    // Construir query base
    let query = supabase
      .from("customers")
      .select(
        `
        id,
        name,
        email,
        phone,
        visits_count,
        last_booking_at,
        total_spent_cents,
        no_show_count,
        is_vip,
        is_banned,
        marketing_opt_in,
        tags,
        created_at
      `
      )
      .eq("tenant_id", tenantId);

    // Aplicar filtros server-side
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const activityThreshold = ninetyDaysAgo.toISOString();

    if (activityFilter === "active90") {
      query = query.gte("last_booking_at", activityThreshold);
    } else if (activityFilter === "inactive90") {
      query = query.or(
        `last_booking_at.is.null,last_booking_at.lt.${activityThreshold}`
      );
    }

    if (segmentFilter === "vip") {
      query = query.eq("is_vip", true);
    } else if (segmentFilter === "banned") {
      query = query.eq("is_banned", true);
    } else if (segmentFilter === "marketing") {
      query = query.eq("marketing_opt_in", true);
    }

    // Ordenar
    if (sortOption === "value") {
      query = query
        .order("total_spent_cents", { ascending: false, nullsFirst: true })
        .order("last_booking_at", { ascending: false, nullsFirst: false });
    } else {
      query = query
        .order("last_booking_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
    }

    const { data: customersData, error: customersError } = await query;

    if (customersError) {
      return NextResponse.json(
        { error: customersError.message },
        { status: 500 }
      );
    }

    // Aplicar filtros client-side (búsqueda, visitas, sin contacto)
    let filtered = (customersData || []).filter((customer) => {
      // Filtro por visitas
      if (visitFilter === "with") {
        const hasBookings = (customer.visits_count ?? 0) > 0;
        if (!hasBookings) return false;
      } else if (visitFilter === "without") {
        const hasBookings = (customer.visits_count ?? 0) > 0;
        if (hasBookings) return false;
      }

      // Filtro "sin contacto"
      if (segmentFilter === "no_contact") {
        const hasEmail = Boolean(customer.email?.trim());
        const hasPhone = Boolean(customer.phone?.trim());
        if (hasEmail || hasPhone) return false;
      }

      // Búsqueda
      if (searchTerm.trim()) {
        const query = searchTerm.trim().toLowerCase();
        const nameMatch = customer.name?.toLowerCase().includes(query);
        const emailMatch = customer.email?.toLowerCase().includes(query);
        const phoneMatch = customer.phone?.includes(query);
        if (!nameMatch && !emailMatch && !phoneMatch) return false;
      }

      return true;
    });

    // Generar CSV
    const headers = [
      "Nombre",
      "Email",
      "Teléfono",
      "Visitas",
      "Última visita",
      "Total gastado (€)",
      "No-shows",
      "VIP",
      "Baneado",
      "Marketing opt-in",
      "Etiquetas",
    ];

    const rows = filtered.map((customer) => {
      const lastVisit = customer.last_booking_at
        ? new Date(customer.last_booking_at).toLocaleString("es-ES", {
            dateStyle: "short",
            timeStyle: "short",
          })
        : "";

      const totalSpent = customer.total_spent_cents
        ? (customer.total_spent_cents / 100).toFixed(2)
        : "0.00";

      const tags = Array.isArray(customer.tags) && customer.tags.length > 0
        ? customer.tags.join(", ")
        : "";

      return [
        customer.name || "",
        customer.email || "",
        customer.phone || "",
        String(customer.visits_count ?? 0),
        lastVisit,
        totalSpent,
        String(customer.no_show_count ?? 0),
        customer.is_vip ? "Sí" : "No",
        customer.is_banned ? "Sí" : "No",
        customer.marketing_opt_in ? "Sí" : "No",
        tags,
      ];
    });

    // Escapar valores CSV (manejar comillas y comas)
    const escapeCsvValue = (value: string): string => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const csvRows = [
      headers.map(escapeCsvValue).join(","),
      ...rows.map((row) => row.map(escapeCsvValue).join(",")),
    ];

    const csvContent = csvRows.join("\n");

    // BOM para UTF-8 (Excel compatibility)
    const bom = "\uFEFF";
    const csvWithBom = bom + csvContent;

    return new NextResponse(csvWithBom, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="clientes-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Error al exportar clientes" },
      { status: 500 }
    );
  }
}

