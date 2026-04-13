import { NextRequest, NextResponse } from "next/server";
import { createClientForServer } from "@/lib/supabase/server-client";
import { supabaseServer } from "@/lib/supabase";
import { z } from "zod";
import { BookingStatus } from "@/types/agenda";
import { isValidStatusTransition } from "@/lib/booking-status-transitions";

const BookingStatusSchema = z.object({
  bookingId: z.string().uuid("ID de reserva inválido"),
  status: z.enum(["hold", "pending", "confirmed", "paid", "completed", "cancelled", "no_show"] as const),
});

export async function PATCH(request: NextRequest) {
  try {
    // ── 1. Autenticación ──────────────────────────────────────────────────────
    const supabaseAuth = await createClientForServer();
    const {
      data: { session },
    } = await supabaseAuth.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // ── 2. Obtener tenant del usuario ─────────────────────────────────────────
    const { data: membership } = await supabaseAuth
      .from("memberships")
      .select("tenant_id")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!membership?.tenant_id) {
      return NextResponse.json({ error: "Sin acceso al panel" }, { status: 403 });
    }

    const tenantId = membership.tenant_id;

    // ── 3. Validar body ───────────────────────────────────────────────────────
    const body = await request.json();
    const parseResult = BookingStatusSchema.safeParse(body);

    if (!parseResult.success) {
      const message =
        parseResult.error.issues[0]?.message ??
        "Datos inválidos para actualizar estado de reserva.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { bookingId, status: newStatus } = parseResult.data;
    const adminClient = supabaseServer();

    // ── 4. Verificar que el booking pertenece al tenant y obtener estado actual ─
    const { data: currentBooking, error: fetchError } = await (adminClient as any)
      .from("bookings")
      .select("id, status, tenant_id")
      .eq("id", bookingId)
      .eq("tenant_id", tenantId)
      .single();

    if (fetchError || !currentBooking) {
      return NextResponse.json(
        { error: "Reserva no encontrada." },
        { status: 404 }
      );
    }

    // ── 5. Validar que la transición de estado es permitida ───────────────────
    const currentStatus = currentBooking.status as BookingStatus;
    if (!isValidStatusTransition(currentStatus, newStatus, true)) {
      return NextResponse.json(
        {
          error: `Transición de estado no permitida: ${currentStatus} → ${newStatus}`,
        },
        { status: 422 }
      );
    }

    // ── 6. Aplicar el cambio de estado ────────────────────────────────────────
    const { data, error } = await (adminClient as any)
      .from("bookings")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", bookingId)
      .select("id, status")
      .single();

    if (error) {
      console.error("[booking-status] Supabase update error:", {
        code: error.code,
        message: error.message,
        bookingId,
      });
      return NextResponse.json(
        { error: error.message ?? "Error al actualizar estado de reserva" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      booking: data,
    });
  } catch (err) {
    console.error("[booking-status] Unexpected error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
