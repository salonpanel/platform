import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get("tenant_id");
    const inactiveDays = parseInt(searchParams.get("days") || "60", 10);

    if (!tenantId) {
      return NextResponse.json({ error: "tenant_id is required" }, { status: 400 });
    }

    // Verify session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);
    const cutoffISO = cutoffDate.toISOString();

    // Get all customers for tenant that have email or phone,
    // whose last booking was before the cutoff (or they have no bookings)
    const { data: customers, error } = await supabase
      .from("customers")
      .select(`
        id,
        name,
        email,
        phone,
        last_booking_at,
        visits_count,
        total_spent_cents,
        marketing_opt_in,
        is_banned,
        tags
      `)
      .eq("tenant_id", tenantId)
      .eq("is_banned", false)
      .not("email", "is", null)
      .or(`last_booking_at.lt.${cutoffISO},last_booking_at.is.null`)
      .order("last_booking_at", { ascending: true, nullsFirst: true })
      .limit(200);

    if (error) throw error;

    return NextResponse.json({
      clients: customers || [],
      cutoff_date: cutoffISO,
      inactive_days: inactiveDays,
    });
  } catch (err: any) {
    console.error("[marketing/inactive-clients]", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
