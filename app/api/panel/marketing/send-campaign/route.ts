import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface CampaignPayload {
  tenant_id: string;
  subject: string;
  body_html: string;
  client_ids: string[];
  campaign_name: string;
  from_name?: string;
  from_email?: string;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();

    // Verify session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload: CampaignPayload = await req.json();
    const { tenant_id, subject, body_html, client_ids, campaign_name, from_name, from_email } = payload;

    if (!tenant_id || !subject || !body_html || !client_ids?.length) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    // Get tenant info + verify access
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id, name, email")
      .eq("id", tenant_id)
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
    }

    // Get client emails
    const { data: clients, error: clientsError } = await supabase
      .from("customers")
      .select("id, name, email")
      .eq("tenant_id", tenant_id)
      .in("id", client_ids)
      .not("email", "is", null);

    if (clientsError) throw clientsError;

    const validClients = (clients || []).filter(c => c.email);
    if (validClients.length === 0) {
      return NextResponse.json({ error: "Ningún cliente con email válido" }, { status: 400 });
    }

    const senderName = from_name || tenant.name || "BookFast";
    const senderEmail = from_email || "noreply@resend.dev";

    // Send emails in batches of 10
    const results = { sent: 0, failed: 0, errors: [] as string[] };
    const batchSize = 10;

    for (let i = 0; i < validClients.length; i += batchSize) {
      const batch = validClients.slice(i, i + batchSize);
      await Promise.allSettled(
        batch.map(async (client) => {
          // Personalise HTML
          const personalizedHtml = body_html
            .replace(/\{\{nombre\}\}/gi, client.name || "cliente")
            .replace(/\{\{negocio\}\}/gi, tenant.name || senderName);

          try {
            await resend.emails.send({
              from: `${senderName} <${senderEmail}>`,
              to: client.email!,
              subject,
              html: personalizedHtml,
            });
            results.sent++;
          } catch (err: any) {
            results.failed++;
            results.errors.push(`${client.email}: ${err.message}`);
          }
        })
      );
    }

    // Log campaign to DB (if marketing_campaigns table exists)
    try {
      await supabase.from("marketing_campaigns").insert({
        tenant_id,
        name: campaign_name,
        subject,
        body_html,
        target_client_count: validClients.length,
        sent_count: results.sent,
        failed_count: results.failed,
        status: results.sent > 0 ? "sent" : "failed",
        sent_at: new Date().toISOString(),
      });
    } catch {
      // Table may not exist yet — silently skip
    }

    return NextResponse.json({
      success: true,
      sent: results.sent,
      failed: results.failed,
      total: validClients.length,
      errors: results.errors.slice(0, 5), // Only return first 5 errors
    });
  } catch (err: any) {
    console.error("[marketing/send-campaign]", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
