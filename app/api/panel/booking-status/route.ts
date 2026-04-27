import { NextRequest, NextResponse } from "next/server";
import { createClientForServer } from "@/lib/supabase/server-client";
import { supabaseServer } from "@/lib/supabase";
import { z } from "zod";
import { BookingStatus, BookingState, PaymentStatus } from "@/types/agenda";
import { isValidStatusTransition } from "@/lib/booking-status-transitions";

const BookingUpdateSchema = z
  .object({
    bookingId: z.string().uuid("ID de reserva inválido"),
    // Legacy single status
    status: z.enum(["hold", "pending", "confirmed", "paid", "completed", "cancelled", "no_show"] as const).optional(),
    // New dual-state model
    booking_state: z.enum(["pending", "confirmed", "arrived", "in_progress", "completed", "cancelled", "no_show"] as const).optional(),
    payment_status: z.enum(["unpaid", "deposit", "paid"] as const).optional(),
  })
  .refine((v) => Boolean(v.status || v.booking_state || v.payment_status), {
    message: "Debes enviar status o booking_state o payment_status",
  });

function deriveLegacyStatus(input: { booking_state: BookingState; payment_status: PaymentStatus }): BookingStatus {
  const { booking_state, payment_status } = input;
  if (booking_state === "cancelled") return "cancelled";
  if (booking_state === "no_show") return "no_show";
  if (booking_state === "completed") return "completed";
  if (payment_status === "paid") return "paid";
  if (booking_state === "in_progress") return "confirmed";
  if (booking_state === "arrived") return "confirmed";
  if (booking_state === "confirmed") return "confirmed";
  return "pending";
}

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
    const parseResult = BookingUpdateSchema.safeParse(body);

    if (!parseResult.success) {
      const message =
        parseResult.error.issues[0]?.message ??
        "Datos inválidos para actualizar estado de reserva.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { bookingId, status: newStatusLegacy, booking_state, payment_status } = parseResult.data;
    const adminClient = supabaseServer();

    // ── 4. Verificar que el booking pertenece al tenant y obtener estado actual ─
    const { data: currentBooking, error: fetchError } = await (adminClient as any)
      .from("bookings")
      .select("id, status, tenant_id, booking_state, payment_status")
      .eq("id", bookingId)
      .eq("tenant_id", tenantId)
      .single();

    if (fetchError || !currentBooking) {
      return NextResponse.json(
        { error: "Reserva no encontrada." },
        { status: 404 }
      );
    }

    const currentStatus = currentBooking.status as BookingStatus;
    const nextBookingState: BookingState =
      (booking_state as BookingState) ??
      (currentBooking.booking_state as BookingState) ??
      (currentStatus === "cancelled"
        ? "cancelled"
        : currentStatus === "no_show"
          ? "no_show"
          : currentStatus === "completed"
            ? "completed"
            : currentStatus === "confirmed"
              ? "confirmed"
              : "pending");
    const nextPaymentStatus: PaymentStatus =
      (payment_status as PaymentStatus) ??
      (currentBooking.payment_status as PaymentStatus) ??
      (currentStatus === "paid" || currentStatus === "completed" ? "paid" : "unpaid");

    const nextLegacyStatus: BookingStatus = newStatusLegacy
      ? (newStatusLegacy as BookingStatus)
      : deriveLegacyStatus({ booking_state: nextBookingState, payment_status: nextPaymentStatus });

    // ── 5. Validar transición legacy (solo si nos llega status explícito) ─────
    if (newStatusLegacy && !isValidStatusTransition(currentStatus, nextLegacyStatus, true)) {
      return NextResponse.json(
        {
          error: `Transición de estado no permitida: ${currentStatus} → ${nextLegacyStatus}`,
        },
        { status: 422 }
      );
    }

    // ── 6. Aplicar cambios ────────────────────────────────────────────────────
    const { data, error } = await (adminClient as any)
      .from("bookings")
      .update({
        status: nextLegacyStatus,
        booking_state: nextBookingState,
        payment_status: nextPaymentStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookingId)
      .select("id, status, booking_state, payment_status")
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
