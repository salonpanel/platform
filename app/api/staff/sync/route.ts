import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { supabaseServer } from "@/lib/supabase";
import { assertMembership } from "@/lib/server/assertMembership";

// Sincroniza memberships -> users(staging) -> staff
// Asegura que todos los miembros (owner/admin/staff/viewer) tengan fila en public.users y staff (si corresponde)
// Nota: public.users es el perfil por-tenant usado por FKs legacy

type Body = {
  tenantId: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const tenantId = body?.tenantId;
    if (!tenantId) {
      return NextResponse.json({ ok: false, error: "Missing tenantId" }, { status: 400 });
    }

    // 1) Verificar sesión y membership
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) return NextResponse.json({ ok: false, error: "Unauthenticated" }, { status: 401 });

    // Llamar a assertMembership
    const membership = await assertMembership(supabaseServer(), session.user.id, tenantId);

    if (!["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    // 2) Usar Service Role para operaciones administrativas
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    // 3) Obtener memberships del tenant
    const { data: members, error: membersErr } = await admin
      .from("memberships")
      .select("user_id, role")
      .eq("tenant_id", tenantId)
      .in("role", ["owner", "admin", "staff"]);
    if (membersErr) throw membersErr;

    // 4) Obtener user_ids ya presentes en public.users para este tenant
    const { data: existingUsers, error: usersErr } = await admin
      .from("users")
      .select("id")
      .eq("tenant_id", tenantId);
    if (usersErr) throw usersErr;
    const existingUserIds = new Set((existingUsers || []).map((u: any) => u.id));

    // 5) Mapear roles de memberships -> roles válidos en public.users
    const mapRole = (r: string) => (r === "admin" ? "manager" : r);

    // 6) Insertar en public.users si faltan
    const usersToInsert = (members || [])
      .filter((m) => !existingUserIds.has(m.user_id))
      .map((m) => ({ id: m.user_id, tenant_id: tenantId, role: mapRole(m.role) }));

    if (usersToInsert.length > 0) {
      const { error: insUsersErr } = await admin.from("users").insert(usersToInsert).select("id");
      if (insUsersErr) throw insUsersErr;
      usersToInsert.forEach((u) => existingUserIds.add(u.id));
    }

    // 7) Obtener staff existentes por user_id
    const { data: staffRows, error: staffErr } = await admin
      .from("staff")
      .select("user_id")
      .eq("tenant_id", tenantId);
    if (staffErr) throw staffErr;
    const existingStaffUserIds = new Set((staffRows || []).map((s: any) => s.user_id).filter(Boolean));

    // 8) Para cada membership, si no hay staff con ese user_id, crearlo
    // Obtener nombres de auth.users para mejorar display_name
    // Nota: Admin API puede listar usuarios uno a uno; optimizamos por lotes cuando sea posible.
    const missing = (members || []).filter((m) => !existingStaffUserIds.has(m.user_id));

    const created: string[] = [];
    for (const m of missing) {
      // Leer auth.users para full_name/email
      let displayName = "Usuario";
      try {
        const { data: authUser } = await admin.auth.admin.getUserById(m.user_id);
        const fullName = (authUser?.user?.user_metadata as any)?.full_name as string | undefined;
        const email = authUser?.user?.email || "";
        displayName = fullName || (email ? email.split("@")[0] : "Usuario");
      } catch {}

      const { error: insStaffErr } = await admin.from("staff").insert({
        tenant_id: tenantId,
        name: displayName,
        display_name: displayName,
        active: true,
        user_id: m.user_id,
        skills: [],
      });
      if (insStaffErr) throw insStaffErr;
      created.push(m.user_id);
    }

    return NextResponse.json({ ok: true, createdCount: created.length });
  } catch (error: any) {
    console.error("/api/staff/sync error", error);
    return NextResponse.json({ ok: false, error: error?.message || "Internal error" }, { status: 500 });
  }
}
