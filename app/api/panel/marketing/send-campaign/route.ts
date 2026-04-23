import { NextRequest, NextResponse } from "next/server";
import { createClientForServer } from "@/lib/supabase/server-client";
import { runMarketingEmailBroadcast } from "@/lib/marketing/email-broadcast";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClientForServer();

    // Verify session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload: {
      tenant_id: string;
      subject: string;
      body_html: string;
      client_ids: string[];
      campaign_name: string;
      from_name?: string;
      from_email?: string;
    } = await req.json();
    const {
      tenant_id,
      subject,
      body_html,
      client_ids,
      campaign_name,
      from_name,
      from_email,
    } = payload;

    if (!tenant_id || !subject || !body_html || !client_ids?.length) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios" },
        { status: 400 },
      );
    }

    // Get tenant + verify it exists
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id, name, email")
      .eq("id", tenant_id)
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
    }

    const result = await runMarketingEmailBroadcast({
      tenantId: tenant_id,
      clientIds: client_ids,
      subject,
      bodyHtml: body_html,
      campaignName: campaign_name,
      fromName: from_name,
      fromEmail: from_email,
      persistCampaign: true,
    });

    if (!result.ok) {
      const status =
        result.error.includes("Falta configuración") ||
        result.error.includes("email válido")
          ? 400
          : 500;
      return NextResponse.json(
        { error: result.error, hint: result.hint },
        { status },
      );
    }

    const { data } = result;
    return NextResponse.json({
      success: true,
      sent: data.sent,
      failed: data.failed,
      total: data.targetWithEmail,
      skipped: data.skipped,
      errors: data.errors,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[marketing/send-campaign]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
