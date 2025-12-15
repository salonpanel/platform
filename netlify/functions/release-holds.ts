import { getSupabaseAdmin } from "../../src/lib/supabase/admin";

export const handler = async (event: any) => {
  try {
    // Verify cron secret
    const key = event.headers['x-cron-key'] || event.queryStringParameters?.key;
    const expectedKey = process.env.INTERNAL_CRON_KEY;

    if (!expectedKey) {
      console.error("INTERNAL_CRON_KEY no configurado");
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Configuración faltante" })
      };
    }

    if (key !== expectedKey) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Unauthorized" })
      };
    }

    const sb = getSupabaseAdmin();

    // Direct call to release expired holds function
    const { data, error } = await sb.rpc("release_expired_holds");

    if (error) {
      console.error("Error al limpiar holds expirados:", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message ?? "Error al limpiar holds" })
      };
    }

    const releasedCount = (data as number) || 0;

    console.info("cron:release_holds", {
      released: releasedCount,
      timestamp: new Date().toISOString()
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        released: releasedCount,
      })
    };
  } catch (err: any) {
    console.error("Error inesperado en release-holds:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err?.message ?? "Error inesperado" })
    };
  }
};
