import { createClientForServer } from "@/lib/supabase/server-client";
import { supabaseServer } from "@/lib/supabase";

export type ChatPageDataset = {
  tenant: {
    id: string;
    name: string;
    timezone: string;
    /** Logo de la barbería (tenants.logo_url) para el chat grupal */
    logoUrl?: string | null;
  };
  conversations: Array<{
    id: string;
    tenantId: string;
    type: "all" | "direct" | "group";
    name: string;
    lastMessageBody: string | null;
    lastMessageAt: string | null;
    unreadCount: number;
    membersCount: number;
    lastReadAt: string | null;
    createdBy: string;
    viewerRole: "member" | "admin";
    lastMessageSenderId?: string | null;
    targetUserId?: string | null;
  }>;
  membersDirectory: Record<
    string,
    {
      userId: string;
      displayName: string;
      tenantRole: string;
      profilePhotoUrl?: string;
    }
  >;
};

/**
 * Carga inicial del chat en el servidor (misma semántica que agenda: tenant + impersonación admin).
 */
export async function getInitialChatPageData(
  impersonateOrgId: string | null
): Promise<{ data: ChatPageDataset | null; error: string | null }> {
  const supabase = await createClientForServer();
  const serviceClient = supabaseServer();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (!user || authError) {
    return { data: null, error: "No authenticated user found" };
  }

  let targetTenantId: string | null = null;

  if (impersonateOrgId) {
    const { data: isAdmin } = await serviceClient.rpc("check_platform_admin", {
      p_user_id: user.id,
    });
    if (isAdmin) {
      targetTenantId = impersonateOrgId;
    }
  }

  if (!targetTenantId) {
    const { data: membership } = await serviceClient
      .from("memberships")
      .select("tenant_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .maybeSingle();

    targetTenantId = membership?.tenant_id ?? null;
  }

  if (!targetTenantId) {
    return { data: null, error: "No membership found for this user" };
  }

  const { data: tenantRow, error: tenantError } = await serviceClient
    .from("tenants")
    .select("id, name, timezone, logo_url")
    .eq("id", targetTenantId)
    .maybeSingle();

  if (tenantError || !tenantRow) {
    return { data: null, error: "Tenant record not found" };
  }

  const [conversationsResult, membersResult] = await Promise.all([
    supabase.rpc("get_user_conversations_optimized", {
      p_user_id: null,
      p_tenant_id: targetTenantId,
    }),
    supabase.rpc("list_tenant_members", { p_tenant_id: targetTenantId }),
  ]);

  if (conversationsResult.error) {
    return {
      data: null,
      error: conversationsResult.error.message || "Error loading conversations",
    };
  }
  if (membersResult.error) {
    return {
      data: null,
      error: membersResult.error.message || "Error loading members",
    };
  }

  const conversations = conversationsResult.data || [];
  const members = membersResult.data || [];

  const membersDirectory: ChatPageDataset["membersDirectory"] = {};
  for (const member of members) {
    membersDirectory[member.user_id] = {
      userId: member.user_id,
      displayName: member.display_name,
      tenantRole: member.tenant_role,
      profilePhotoUrl: member.avatar_url || undefined,
    };
  }

  return {
    data: {
      tenant: {
        id: tenantRow.id,
        name: tenantRow.name || "Tu negocio",
        timezone: tenantRow.timezone || "Europe/Madrid",
        logoUrl: (tenantRow as { logo_url?: string | null }).logo_url ?? null,
      },
      conversations: conversations.map((conv: Record<string, unknown>) => ({
        id: conv.id as string,
        tenantId: conv.tenant_id as string,
        type: conv.type as "all" | "direct" | "group",
        name: conv.name as string,
        lastMessageBody: (conv.last_message_body as string) ?? null,
        lastMessageAt: (conv.last_message_at as string) ?? null,
        unreadCount: (conv.unread_count as number) || 0,
        membersCount: (conv.members_count as number) || 0,
        lastReadAt: (conv.last_read_at as string) ?? null,
        createdBy: conv.created_by as string,
        viewerRole: conv.viewer_role as "member" | "admin",
        lastMessageSenderId: (conv.last_message_sender_id as string) ?? null,
        targetUserId: (conv.target_user_id as string) ?? null,
      })),
      membersDirectory,
    },
    error: null,
  };
}
