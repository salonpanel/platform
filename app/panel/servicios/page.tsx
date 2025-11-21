import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { Alert } from "@/components/ui/Alert";
import type { Service } from "@/types/services";
import { ServiciosClient } from "./ServiciosClient";

type ServiciosPageProps = {
  searchParams?: Promise<{
    impersonate?: string;
  }>;
};

export default async function ServiciosPage({ searchParams }: ServiciosPageProps) {
  // ❗ IMPORTANTE: NO "use client" en este archivo

  // 1) Obtenemos el store de cookies de Next (await porque es async en Next.js 15+)
  const cookieStore = await cookies();

  // 2) Se lo pasamos al helper. El helper espera una función, pero
  //    en esta versión las cookies ya están resueltas, así que devolvemos el objeto.
  const supabase = createServerComponentClient({
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error La versión actual del helper tipa este campo como función async
    cookies: () => cookieStore,
  });

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const impersonateOrgId = resolvedSearchParams?.impersonate ?? null;

  // 3) Validamos sesión
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (!session || sessionError) {
    return (
      <Alert type="error" title="Sesión no disponible">
        Tu sesión no está activa o ha expirado. Vuelve a iniciar sesión desde la página de login.
      </Alert>
    );
  }

  let tenantId: string | null = null;

  // 4) Soporte de impersonación para platform admins
  if (impersonateOrgId) {
    const { data: isAdmin, error: adminError } = await supabase.rpc(
      "check_platform_admin",
      { p_user_id: session.user.id }
    );

    if (adminError) {
      console.error("Error check_platform_admin:", adminError);
    }

    if (isAdmin) {
      tenantId = impersonateOrgId;
    }
  }

  // 5) Fallback: primer tenant del usuario
  if (!tenantId) {
    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("tenant_id")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      console.error("Error al obtener membership:", membershipError);
    }

    tenantId = membership?.tenant_id ?? null;
  }

  // 6) Sin barbería asignada
  if (!tenantId) {
    return (
      <Alert type="error" title="No se encontró ninguna barbería">
        No tienes acceso a ninguna organización. Solicita acceso a un tenant para continuar.
      </Alert>
    );
  }

  // 7) Carga inicial de servicios
  const { data: services, error: servicesError } = await supabase
    .from("services")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("name");

  if (servicesError) {
    return (
      <Alert type="error" title="Error al cargar servicios">
        {servicesError.message}
      </Alert>
    );
  }

  // 8) Delegamos toda la UX/RT en el cliente
  return (
    <ServiciosClient
      tenantId={tenantId}
      initialServices={(services ?? []) as Service[]}
    />
  );
}
