import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { z } from "zod";
import { BookingStatus } from "@/types/agenda";

const BookingStatusSchema = z.object({
  bookingId: z.string().uuid("ID de reserva inválido"),
  status: z.enum(["hold", "pending", "paid", "completed", "cancelled", "no_show"] as const),
});

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const parseResult = BookingStatusSchema.safeParse(body);

    if (!parseResult.success) {
      const message =
        parseResult.error.issues[0]?.message ??
        "Datos inválidos para actualizar estado de reserva.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { bookingId, status } = parseResult.data;

    const supabase = supabaseServer();

    // Actualizar estado en la tabla de bookings
    const { data, error } = await (supabase as any)
      .from("bookings")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", bookingId)
      .select("id, status")
      .single();

    if (error) {
      console.error("[booking-status] Supabase error:", {
        code: error.code,
        message: error.message,
        bookingId,
      });

      // Si no existe el registro, retornar 404
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Reserva no encontrada." },
          { status: 404 }
        );
      }

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
