/**
 * Envío de emails vía Resend (campañas o mensaje 1:1) + registro en
 * `marketing_campaigns`. Usado por el panel y por las tools del asistente.
 */

import { Resend } from "resend";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const BATCH = 10;

export interface MarketingEmailRunOk {
  sent: number;
  failed: number;
  targetWithEmail: number;
  /** IDs pedidos que no se encontraron o sin email. */
  skipped: number;
  errors: string[];
  campaignName: string;
  subject: string;
}

export type MarketingEmailRunResult =
  | { ok: true; data: MarketingEmailRunOk }
  | { ok: false; error: string; hint?: string };

/**
 * Carga el tenant, resuelve clientes por id, personaliza `{{nombre}}` /
 * `{{negocio}}`, envía y opcionalmente inserta en `marketing_campaigns`.
 */
export async function runMarketingEmailBroadcast(input: {
  tenantId: string;
  clientIds: string[];
  subject: string;
  bodyHtml: string;
  campaignName: string;
  fromName?: string | null;
  fromEmail?: string | null;
  /** Si false, no inserta fila (solo envío). Hoy usamos true en panel y asistente. */
  persistCampaign: boolean;
}): Promise<MarketingEmailRunResult> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return {
      ok: false,
      error: "Falta configuración de email (Resend) en el servidor.",
      hint: "Añade RESEND_API_KEY en el entorno de despliegue.",
    };
  }

  const uniqueIds = [...new Set(input.clientIds.map((x) => x.trim()))].filter(
    Boolean,
  );
  if (uniqueIds.length === 0) {
    return { ok: false, error: "No se indicó ningún destinatario." };
  }

  const supabase = getSupabaseAdmin();
  const { data: tenant, error: tErr } = await supabase
    .from("tenants")
    .select("id, name, email")
    .eq("id", input.tenantId)
    .maybeSingle();

  if (tErr || !tenant) {
    return { ok: false, error: "Negocio no encontrado." };
  }

  const t = tenant as { id: string; name: string | null; email: string | null };
  const { data: clientRows, error: cErr } = await (supabase.from("customers") as any)
    .select("id, name, email")
    .eq("tenant_id", input.tenantId)
    .in("id", uniqueIds);

  if (cErr) {
    return { ok: false, error: "No se pudieron cargar los clientes." };
  }

  const rows =
    (clientRows as unknown as Array<{
      id: string;
      name: string | null;
      email: string | null;
    }>) ?? [];

  const validClients = rows.filter(
    (c) => !!c.email && String(c.email).trim() !== "",
  );

  if (validClients.length === 0) {
    return {
      ok: false,
      error: "Ningún destinatario con email válido entre los clientes indicados.",
      hint: "Asegúrate de que tengan email o revisa que los identificadores sean correctos.",
    };
  }

  /** Ids distintos pedidos que no se enviaron: sin fila, sin email, etc. */
  const skipped = uniqueIds.length - validClients.length;
  const senderName = input.fromName?.trim() || t.name || "BookFast";
  const senderEmail = input.fromEmail?.trim() || "noreply@resend.dev";
  const resend = new Resend(resendKey);

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < validClients.length; i += BATCH) {
    const batch = validClients.slice(i, i + BATCH);
    await Promise.allSettled(
      batch.map(async (client) => {
        const personalizedHtml = input.bodyHtml
          .replace(/\{\{nombre\}\}/gi, client.name || "cliente")
          .replace(/\{\{negocio\}\}/gi, t.name || senderName);
        try {
          await resend.emails.send({
            from: `${senderName} <${senderEmail}>`,
            to: client.email!,
            subject: input.subject,
            html: personalizedHtml,
          });
          sent++;
        } catch (e: unknown) {
          failed++;
          const msg = e instanceof Error ? e.message : String(e);
          errors.push(`${client.email}: ${msg}`);
        }
      }),
    );
  }

  if (input.persistCampaign) {
    const status = sent > 0 ? "sent" : "failed";
    const { error: insErr } = await (supabase.from("marketing_campaigns") as any)
      .insert({
        tenant_id: input.tenantId,
        name: input.campaignName,
        subject: input.subject,
        body_html: input.bodyHtml,
        target_client_count: validClients.length,
        sent_count: sent,
        failed_count: failed,
        status,
        sent_at: new Date().toISOString(),
      });
    if (insErr) {
      // eslint-disable-next-line no-console
      console.error("[marketing] insert marketing_campaigns", insErr);
    }
  }

  return {
    ok: true,
    data: {
      sent,
      failed,
      targetWithEmail: validClients.length,
      skipped,
      errors: errors.slice(0, 8),
      campaignName: input.campaignName,
      subject: input.subject,
    },
  };
}
