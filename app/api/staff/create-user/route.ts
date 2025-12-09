import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase";
import { assertMembership } from "@/lib/server/assertMembership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/staff/create-user
 * Crea un usuario completo con cuenta de autenticación y membership
 * Solo accesible por owners/admins
 */
export async function POST(req: Request) {
  try {
    // Obtener sesión vía createRouteHandlerClient
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    // Obtener datos del body
    const body = await req.json();
    const { email, full_name, role, tenant_id } = body;

    if (!email || !full_name || !role || !tenant_id) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: email, full_name, role, tenant_id" },
        { status: 400 }
      );
    }

    // Llamar a assertMembership
    const membership = await assertMembership(supabaseServer(), session.user.id, tenant_id);

    // Verificar que sea owner o admin
    if (membership.role !== "owner" && membership.role !== "admin") {
      return NextResponse.json(
        { error: "Solo owners y admins pueden crear usuarios" },
        { status: 403 }
      );
    }

    // Validar rol permitido
    const allowedRoles = ["owner", "admin", "staff"];
    if (!allowedRoles.includes(role)) {
      return NextResponse.json(
        { error: "Rol no válido. Debe ser: owner, admin o staff" },
        { status: 400 }
      );
    }

    // Crear usuario usando Supabase Admin API
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Configuración de Supabase incompleta" },
        { status: 500 }
      );
    }

    // Crear usuario con Admin API
    const createUserResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email.toLowerCase().trim(),
        email_confirm: true,
        user_metadata: {
          full_name: full_name.trim(),
        },
      }),
    });

    if (!createUserResponse.ok) {
      const errorData = await createUserResponse.json();
      console.error("Error al crear usuario:", errorData);
      
      // Si el usuario ya existe, intentar obtener su ID
      if (errorData.error_code === "email_exists" || errorData.msg?.includes("already been registered")) {
        // Usar supabaseServer() para consultas directas
        const sb = supabaseServer();
        const { data: existingUser, error: findError } = await sb
          .from("auth.users")
          .select("id")
          .eq("email", email.toLowerCase().trim())
          .single();

        if (findError || !existingUser) {
          return NextResponse.json(
            { error: "El email ya está registrado pero no se pudo obtener el usuario" },
            { status: 409 }
          );
        }

        // Verificar si ya tiene membership en este tenant
        const { data: existingMembership } = await sb
          .from("memberships")
          .select("id")
          .eq("user_id", existingUser.id)
          .eq("tenant_id", tenant_id)
          .single();

        if (existingMembership) {
          return NextResponse.json(
            { error: "Este usuario ya pertenece a esta barbería" },
            { status: 409 }
          );
        }

        // Crear membership para usuario existente
        const { data: newMembership, error: membershipCreateError } = await sb
          .from("memberships")
          .insert({
            tenant_id,
            user_id: existingUser.id,
            role,
          })
          .select()
          .single();

        if (membershipCreateError) {
          console.error("Error al crear membership:", membershipCreateError);
          return NextResponse.json(
            { error: membershipCreateError.message },
            { status: 500 }
          );
        }

        return NextResponse.json({
          user_id: existingUser.id,
          email: email.toLowerCase().trim(),
          full_name: full_name.trim(),
          role,
          membership_id: newMembership.id,
          existing_user: true,
        });
      }

      return NextResponse.json(
        { error: errorData.msg || "Error al crear usuario" },
        { status: createUserResponse.status }
      );
    }

    const userData = await createUserResponse.json();
    const newUserId = userData.id;

    // Crear instancia de Supabase para la consulta
    const sb = supabaseServer();
    // Crear membership
    const { data: newMembership, error: membershipCreateError } = await sb
      .from("memberships")
      .insert({
        tenant_id,
        user_id: newUserId,
        role,
      })
      .select()
      .single();

    if (membershipCreateError) {
      console.error("Error al crear membership:", membershipCreateError);
      // Intentar eliminar el usuario creado si falla la membership
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${newUserId}`, {
        method: "DELETE",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      });

      return NextResponse.json(
        { error: membershipCreateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      user_id: newUserId,
      email: email.toLowerCase().trim(),
      full_name: full_name.trim(),
      role,
      membership_id: newMembership.id,
      existing_user: false,
    });
  } catch (err: any) {
    console.error("Error inesperado:", err);
    return NextResponse.json(
      { error: err?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
