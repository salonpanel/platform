import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { isPlatformAdmin } from "@/lib/platform-auth";

/**
 * GET /api/admin/platform-users
 * Lista todos los platform users (solo platform admins)
 */
export async function GET() {
  try {
    // Verificar que el usuario es platform admin
    const isAdmin = await isPlatformAdmin();
    if (!isAdmin) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 403 }
      );
    }

    const supabase = supabaseServer();
    const { data, error } = await supabase
      .rpc("get_platform_users")
      .select("*");

    // Si la función no existe, usar consulta directa
    if (error && error.code === "42883") {
      const { data: users, error: queryError } = await supabase
        .from("platform_users")
        .select("*")
        .order("created_at", { ascending: false });

      if (queryError) {
        return NextResponse.json(
          { error: queryError.message },
          { status: 500 }
        );
      }

      return NextResponse.json(users);
    }

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Error al obtener platform users" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/platform-users
 * Crea un nuevo platform user (solo platform admins)
 */
export async function POST(req: Request) {
  try {
    const isAdmin = await isPlatformAdmin();
    if (!isAdmin) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 403 }
      );
    }

    const { user_id, email, name, role = "admin" } = await req.json();

    if (!user_id || !email || !name) {
      return NextResponse.json(
        { error: "user_id, email y name son obligatorios" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();
    
    // Usar función RPC si existe, sino insert directo
    const { data, error } = await supabase
      .rpc("create_platform_admin", {
        p_user_id: user_id,
        p_email: email,
        p_name: name,
        p_role: role,
      })
      .single();

    if (error && error.code === "42883") {
      // Función no existe, usar insert directo
      const { data: newUser, error: insertError } = await supabase
        .from("platform_users")
        .insert({
          id: user_id,
          email,
          name,
          role,
          active: true,
        })
        .select()
        .single();

      if (insertError) {
        return NextResponse.json(
          { error: insertError.message },
          { status: 500 }
        );
      }

      // Log en audit
      await supabase.from("audit_logs").insert({
        actor_type: "platform",
        scope: "platform",
        action: "platform_user_created",
        target_type: "platform_user",
        target_id: newUser.id,
        metadata: { email, role },
      });

      return NextResponse.json(newUser, { status: 201 });
    }

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Log en audit
    await supabase.from("audit_logs").insert({
      actor_type: "platform",
      scope: "platform",
      action: "platform_user_created",
      target_type: "platform_user",
      target_id: data,
      metadata: { email, role },
    });

    return NextResponse.json({ id: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Error al crear platform user" },
      { status: 500 }
    );
  }
}









