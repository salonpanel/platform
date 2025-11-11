import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export async function POST(req: Request) {
  const { org_id, name, duration_min, price_cents } = await req.json();
  if (!org_id || !name || !duration_min || !price_cents) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const sb = supabaseServer();
  const { data, error } = await sb
    .from("services")
    .insert([{ org_id, name, duration_min, price_cents }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
