import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase";
import { assertMembership } from "@/lib/server/assertMembership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const legacyRoleMap: Record<string, string> = {
  admin: "manager",
};

const mapLegacyRole = (role: string) => legacyRoleMap[role] ?? role;

async function ensureLegacyUserRecord(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string,
  role: string
) {
  const mappedRole = mapLegacyRole(role);
  const { data: existingUser, error: fetchError } = await supabase
    .from("users")
    .select("id, role")
    .eq("id", userId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  if (existingUser) {
    if (existingUser.role !== mappedRole) {
      const { error: updateError } = await supabase
        .from("users")
        .update({ role: mappedRole })
        .eq("id", userId)
        .eq("tenant_id", tenantId);

      if (updateError) {
        throw new Error(updateError.message);
      }
    }
    return;
  }

  const { error: insertError } = await supabase.from("users").insert({
    id: userId,
    tenant_id: tenantId,
    role: mappedRole,
  });

  if (insertError) {
    throw new Error(insertError.message);
  }
}

/**
 * POST /api/staff/create-user
 * Crea un usuario completo con cuenta de autenticación y membership
 * Solo accesible por owners/admins
 */
export async function POST(req: Request) {
  try {
    // Obtener sesión vía createRouteHandlerClient
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: cookieStore });
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
    const {
      email,
      full_name,
      role,
      tenant_id,
    }: { email?: string; full_name?: string; role?: string; tenant_id?: string } = body;

    const normalizedEmail = email?.toLowerCase().trim() ?? "";
    const normalizedFullName = full_name?.trim() ?? "";
    const normalizedRole = role?.toLowerCase().trim() ?? "";
    const tenantId = tenant_id ?? "";

    if (!normalizedEmail || !normalizedFullName || !normalizedRole || !tenantId) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: email, full_name, role, tenant_id" },
        { status: 400 }
      );
    }

    // Llamar a assertMembership
    const membership = await assertMembership(supabaseServer(), session.user.id, tenantId);

    // Verificar que sea owner o admin
    if (membership.role !== "owner" && membership.role !== "admin") {
      return NextResponse.json(
        { error: "Solo owners y admins pueden crear usuarios" },
        { status: 403 }
      );
    }

    // Validar rol permitido
    const allowedRoles = ["owner", "admin", "staff"];
    if (!allowedRoles.includes(normalizedRole)) {
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
        email: normalizedEmail,
        email_confirm: true,
        user_metadata: {
          full_name: normalizedFullName,
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
          .eq("email", normalizedEmail)
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
          .eq("tenant_id", tenantId)
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
            tenant_id: tenantId,
            user_id: existingUser.id,
            role: normalizedRole,
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

        try {
          await ensureLegacyUserRecord(sb, existingUser.id, tenantId, normalizedRole);
        } catch (legacyError: any) {
          console.error("Error al sincronizar public.users:", legacyError);
          await sb.from("memberships").delete().eq("id", newMembership.id);
          return NextResponse.json(
            { error: "No se pudo sincronizar el perfil legacy del usuario" },
            { status: 500 }
          );
        }

        return NextResponse.json({
          user_id: existingUser.id,
          email: normalizedEmail,
          full_name: normalizedFullName,
          role: normalizedRole,
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
        tenant_id: tenantId,
        user_id: newUserId,
        role: normalizedRole,
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

    try {
      await ensureLegacyUserRecord(sb, newUserId, tenantId, normalizedRole);
    } catch (legacyError: any) {
      console.error("Error al sincronizar public.users:", legacyError);
      await sb.from("memberships").delete().eq("id", newMembership.id);
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${newUserId}`, {
        method: "DELETE",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      });

      return NextResponse.json(
        { error: "No se pudo sincronizar el perfil legacy del usuario" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      user_id: newUserId,
      email: normalizedEmail,
      full_name: normalizedFullName,
      role: normalizedRole,
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
