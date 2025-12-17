import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { holdRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * GET /api/availability
 * Obtiene slots disponibles para un servicio
 * 
 * SEGURIDAD: Público sin sesión, pero protegido por rate limiting y validaciones estrictas
 * 
 * Query params:
 * - tenant: UUID del tenant o slug (requerido) - Se resuelve a tenant_id en servidor
 * - service_id: UUID del servicio (requerido)
 * - staff_id: UUID del staff (opcional, filtra por staff específico)
 * - date: Fecha de inicio (YYYY-MM-DD, opcional, default: hoy)
 * - days_ahead: Días hacia adelante (opcional, default: 30)
 * 
 * Protección:
 * - Rate limiting: 100 req/10min por IP
 * - Validación estricta: tenant_id se resuelve desde slug/UUID en servidor
 */
export async function GET(req: Request) {
  try {
    // Rate limiting
    const ip = getClientIp(req);
    if (holdRateLimit) {
      const { success, reset } = await holdRateLimit.limit(`availability:${ip}`);
      if (!success) {
        return NextResponse.json(
          {
            error: "Se han realizado demasiadas solicitudes. Inténtalo más tarde.",
            code: "RATE_LIMIT"
          },
          { status: 429 }
        );
      }
    }
    const { searchParams } = new URL(req.url);

    const tenant = searchParams.get("tenant"); // Puede ser UUID o slug
    const serviceId = searchParams.get("service_id");
    const staffId = searchParams.get("staff_id");
    const date = searchParams.get("date");
    const daysAhead = searchParams.get("days_ahead");

    if (!tenant || !serviceId) {
      return NextResponse.json(
        { error: "tenant y service_id son requeridos" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // P1.2: Resolver tenant_id y obtener timezone
    // Intentar primero por ID (UUID)
    let tenantId: string | null = null;
    let tenantTimezone: string = "Europe/Madrid";
    let { data: tenantData, error: tenantError } = await supabase
      .from("tenants")
      .select("id, timezone")
      .eq("id", tenant)
      .maybeSingle();

    // Si no se encuentra por ID, intentar por slug
    if (!tenantData && !tenantError) {
      const { data: tenantBySlug, error: slugError } = await supabase
        .from("tenants")
        .select("id, timezone")
        .eq("slug", tenant)
        .maybeSingle();

      tenantData = tenantBySlug;
      tenantError = slugError;
    }

    if (tenantError || !tenantData) {
      return NextResponse.json(
        { error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    tenantId = tenantData.id;
    tenantTimezone = tenantData.timezone || "Europe/Madrid";

    // Validar que el servicio existe y pertenece al tenant
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("id, tenant_id, active")
      .eq("id", serviceId)
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .maybeSingle();

    if (serviceError || !service) {
      return NextResponse.json(
        { error: "Servicio no encontrado o inactivo" },
        { status: 404 }
      );
    }

    // Validar staff si se proporciona
    if (staffId) {
      const { data: staff, error: staffError } = await supabase
        .from("staff")
        .select("id, tenant_id, active")
        .eq("id", staffId)
        .eq("tenant_id", tenantId)
        .eq("active", true)
        .maybeSingle();

      if (staffError || !staff) {
        return NextResponse.json(
          { error: "Staff no encontrado o inactivo" },
          { status: 404 }
        );
      }
    }

    // Feature Flag: Switch to new RPC if enabled
    const useNewRpc = process.env.NEXT_PUBLIC_USE_RPC_AVAILABILITY === 'true';
    let slotsData, slotsErr;

    if (useNewRpc) {
      // New RPC Path (Strict Tenant Isolation)
      // Input: (p_tenant_id, p_service_id, p_from_date, p_to_date)
      const targetDate = date ? new Date(date) : new Date();
      const days = daysAhead ? parseInt(daysAhead, 10) : 30;
      const toDate = new Date(targetDate);
      toDate.setDate(toDate.getDate() + days);

      const { data, error } = await supabase.rpc(
        "get_public_availability_v1",
        {
          p_tenant_id: tenantId,
          p_service_id: serviceId,
          p_from_date: targetDate.toISOString().split("T")[0],
          p_to_date: toDate.toISOString().split("T")[0],
        }
      );

      // Filter by staff_id if provided (RPC returns all relevant staff)
      if (data && staffId) {
        slotsData = data.filter((s: any) => s.staff_id === staffId);
      } else {
        slotsData = data;
      }
      slotsErr = error;

    } else {
      // Legacy Path (Shadowed/Deprecated)
      const { data, error } = await supabase.rpc(
        "get_available_slots",
        {
          p_tenant_id: tenantId,
          p_service_id: serviceId,
          p_staff_id: staffId || null,
          p_date: date || new Date().toISOString().split("T")[0],
          p_days_ahead: daysAhead ? parseInt(daysAhead, 10) : 30,
        }
      );
      slotsData = data;
      slotsErr = error;
    }

    if (slotsErr) {
      console.error("Error al calcular slots:", slotsErr);
      return NextResponse.json(
        { error: slotsErr.message || "Error al calcular disponibilidad" },
        { status: 500 }
      );
    }

    // P1.2: Retornar slots con timezone del tenant
    return NextResponse.json({
      slots: slotsData || [],
      count: (slotsData || []).length,
      timezone: tenantTimezone, // Timezone del tenant para el frontend
    });
  } catch (err: any) {
    console.error("Error inesperado en availability:", err);
    return NextResponse.json(
      { error: err?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}

