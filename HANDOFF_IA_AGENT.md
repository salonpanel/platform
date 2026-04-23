# HANDOFF — Continuar construyendo BookFast AI (módulo asistente)

> Pega este documento al iniciar una conversación nueva con Claude.
> Es un briefing completo: qué hay, qué falta, cómo trabajar.

---

## 1. Quién eres y qué vas a hacer

Eres un ingeniero senior trabajando junto a **Josep** (owner del proyecto) en **BookFast Pro**, una plataforma SaaS multi-tenant de gestión de reservas para salones de belleza, barberías y centros de estética. Tu tarea concreta en esta sesión es **seguir mejorando el módulo asistente de IA** (`src/lib/asistente/`) que está dentro del repo `platform`.

Josep habla castellano. Tutéale, directo, sin paja. Cuando modifiques código explica qué y por qué en 1-3 frases, no redactes ensayos.

---

## 2. Contexto del proyecto

- **Repo GitHub:** `salonpanel/platform`
- **Vercel project:** `prj_vG0zOFljwtJZk51pW2mL6akd367M` (team `team_dtECUOcwxhIcvVVBeGdH57nl`)
- **Supabase project ID:** `jsqminbgggwhvkfgeibz`
- **Carpeta local en esta sesión:** `/sessions/fervent-sweet-ramanujan/mnt/platform`
- **URL producción:** `pro.bookfast.pro`
- **Stack Platform:** Next.js 16.0.8 (App Router) + React 19 + Turbopack + Tailwind 4 + Supabase + Stripe + Resend + Upstash Redis

Hay dos repos hermanos (Admin, Marketing) pero **en esta sesión no los tocas**. Solo `platform`.

---

## 3. Herramientas que SÍ debes usar

- **Supabase MCP** (`mcp__b3d1060d-…__execute_sql`, `list_tables`, `apply_migration`, `generate_typescript_types`, etc.) — para inspeccionar schema, ejecutar SQL y aplicar migraciones. Usa siempre el `project_id: "jsqminbgggwhvkfgeibz"`.
- **Vercel MCP** (`mcp__…__list_deployments`, `get_deployment_build_logs`) — para ver builds después de que Josep haga push. NO hagas deploy manual.
- **File tools** (`Read`, `Write`, `Edit`, `Glob`, `Grep`) — para editar código en `/sessions/fervent-sweet-ramanujan/mnt/platform`.
- **Bash** — para `npx tsc --noEmit`, `ls`, etc. NO uses `git push` (el proxy lo bloquea; Josep pushea desde su máquina).

---

## 4. Reglas de trabajo NO NEGOCIABLES

1. **No hagas `git push`**. Desde este sandbox el proxy bloquea git remoto. Flujo real: tú editas archivos → Josep hace `git add/commit/push` en su máquina → Vercel auto-deploya → verificas build con Vercel MCP.
2. **Cuidado con sobreescritura**. A veces los commits locales de Josep chocan con cambios del sandbox. Si ves algo raro en un archivo que no recuerdas haber dejado así, pregunta antes de pisar.
3. **Commits a `main` directo**. No hay branches de feature.
4. **tenant_id nunca lo toca el LLM**. Se inyecta siempre desde `ToolRuntimeContext.tenantId`. Cada query debe llevar `.eq("tenant_id", ctx.tenantId)`. Nunca pongas `tenantId` en el Zod schema de una tool.
5. **TypeScript never types**. El tipo `Database` generado es incompleto. Para queries complejas con embeds usa el patrón `(supabase.from("x") as any)` o cast del `data` con `as unknown as Array<{…}>`. Ya hay cientos de ejemplos en `src/lib/asistente/tools/`.
6. **No inventes esquema**. Antes de usar una columna o tabla nueva, verifica con Supabase MCP:
   ```sql
   SELECT column_name, data_type FROM information_schema.columns
   WHERE table_schema='public' AND table_name='<tabla>' ORDER BY ordinal_position;
   ```
7. **Errores pre-existentes de typecheck**. Hay ~30 archivos del repo con NULL bytes y strings sin terminar (corrupción previa). Al correr `npx tsc --noEmit` vas a ver ~500 errores en `app/layout.tsx`, `app/panel/agenda/page.tsx`, `src/components/ui/...`, etc. **NO son tuyos**. Filtra con `grep "src/lib/asistente"` para ver si lo tuyo compila limpio.

---

## 5. Arquitectura del módulo asistente

```
src/lib/asistente/
├── llm/
│   ├── client.ts           # wrapper sobre Vercel AI SDK
│   ├── providers.ts        # Mistral vía @ai-sdk/mistral
│   └── system-prompt.ts    # prompt base versionado (SYSTEM_PROMPT_VERSION)
├── security/
│   ├── audit.ts            # logAudit() escribe a asistente_audit_log
│   └── types.ts            # TenantRole, ToolCategory, AuditStatus…
└── tools/
    ├── helpers.ts          # ok/err/preview/withAudit/centsToEur/formatDateHuman/hasRoleAtLeast
    ├── registry.ts         # buildToolSet(ctx, opts) — registra TODAS las tools
    ├── read/               # READ tools (libres, sin confirmación)
    └── write/              # WRITE tools (patrón preview → confirm=true)
```

**Endpoint:** `app/api/asistente/chat/route.ts` — autentica al usuario via Supabase Auth, construye `ToolRuntimeContext`, llama `buildToolSet(ctx)`, pasa al LLM con `generateText()`.

---

## 6. Estado actual — qué hay implementado (wave 1-3 completadas)

**36 tools registradas:**

### READ (21) — todas en `src/lib/asistente/tools/read/`
- `get_pending_payments` — pagos sin cobrar
- `get_today_agenda` — agenda de hoy
- `search_customers` — buscar clientes por nombre/email/teléfono
- `list_services` — catálogo de servicios
- `get_revenue_summary` — ingresos hoy/7d/mes (RPC `asistente_revenue_summary`)
- `get_customer_detail` — ficha completa (por ID o por query)
- `get_booking_detail` — detalle de una cita
- `list_staff` — staff del negocio
- `find_available_slots` — huecos libres para un servicio
- `get_top_customers` — ranking de clientes por gasto
- `get_top_services` — ranking de servicios
- `get_staff_performance` — ingresos/citas por staff
- `list_bookings_range` — citas por rango (requiere IDs)
- `list_staff_blockings` — vacaciones/ausencias (usa overlap predicate)
- `get_staff_schedule` — horario semanal recurrente
- `list_payments` — tabla `payments` (Stripe) con totales y balance_status
- `search_bookings` — **búsqueda libre de citas por texto** (cliente/servicio/staff) — resuelve el gran hueco de no tener IDs. Estrategia: Promise.all pre-resuelve IDs de customers/services/staff matching, luego OR en bookings.
- `get_customer_insights` — retención: días desde última visita, frecuencia, ticket medio, favoritos, label (activo/enfriándose/dormido/perdido)
- `find_reactivation_candidates` — clientes dormidos ≥X meses, con opt-in marketing, ordenados por valor, excluyendo los que ya tienen cita futura
- `get_business_overview` — snapshot del día (daily_metrics + fallback en vivo)
- `get_tenant_info` — config operativa (horario, cancelación, no-show, Stripe)

### WRITE (15) — todas siguen patrón **preview → confirm**
- `create_service` / `update_service`
- `create_customer` / `update_customer`
- `create_booking` / `cancel_booking` / `reschedule_booking`
- `mark_booking_paid` / `mark_booking_no_show`
- `confirm_booking` / `complete_booking` (`→ completed`, warning si payment_status != "paid")
- `block_staff_time` / `delete_staff_blocking` (tipos DB-válidos: `block | absence | vacation`)
- `add_customer_note` / `add_booking_note` (append con timestamp, no sobreescribe)

**System prompt** (`llm/system-prompt.ts`, versión `2026-04-23.v3`): tono castellano directo, mapa mental de tools, ejemplos multi-paso de razonamiento, reglas de confirmación por modo (supervised/semi/autonomous), RBAC por rol.

---

## 7. Patrones que DEBES seguir al crear una tool nueva

### Plantilla READ

```typescript
import { z } from "zod";
import { tool } from "ai";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ok, err, withAudit, type ToolOutput } from "../helpers";
import type { ToolRuntimeContext } from "../registry";

const InputSchema = z.object({
  // NUNCA tenantId aquí — viene del ctx.
  someFilter: z.string().optional(),
});

interface Payload { /* ... */ }

export function buildMyReadTool(ctx: ToolRuntimeContext) {
  return tool({
    description: "Descripción orientada al LLM — cuándo usarla y qué devuelve.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutput<Payload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "my_read_tool",
          toolCategory: "READ_LOW",  // o READ_HIGH para datos sensibles
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          const supabase = getSupabaseAdmin();
          const { data, error } = await supabase
            .from("some_table")
            .select("…")
            .eq("tenant_id", ctx.tenantId)  // SIEMPRE
            .limit(50);

          if (error) return err("Mensaje de error humano.");

          const rows = (data as unknown as Array<{…}>) ?? [];
          return ok<Payload>("Resumen en 1 frase.", { /* payload */ });
        },
      );
    },
  });
}
```

### Plantilla WRITE (preview → confirm)

```typescript
const InputSchema = z.object({
  // ...campos
  confirm: z.boolean().default(false),
});

// en el execute:
if (!hasRoleAtLeast(ctx.userRole, "manager")) {
  return denyByRole("acción concreta", ctx.userRole);
}

// 1. Cargar el row, validar que existe y pertenece al tenant
// 2. Construir el payload con lo que se haría
// 3. Si !input.confirm → return preview(mensaje, payload);
// 4. Si input.confirm === true → ejecutar update/insert/delete
//    const { error } = await (supabase.from("x") as any).update({...}).eq("tenant_id", ctx.tenantId).eq("id", input.id);
// 5. return ok("Hecho.", payload);
```

### Registrar

Al crear la tool, añadir 3 cosas en `src/lib/asistente/tools/registry.ts`:
1. `import { buildMyReadTool } from "./read/my-read";`
2. En el objeto del return: `my_read_tool: buildMyReadTool(ctx),`
3. Si necesita timezone: `buildMyReadTool(ctx, tz)` y añadir el parámetro en la signature.

---

## 8. Aislamiento multi-tenant (confirmado)

El `tenantId` se inyecta en `ctx` ANTES de que el LLM vea las tools. **El LLM no puede cambiarlo**. Capas de defensa:

1. `/api/asistente/chat` resuelve el tenant del usuario via `memberships` al iniciar el turno.
2. Cada tool hace `.eq("tenant_id", ctx.tenantId)`.
3. Las **RLS policies** de Supabase aplican un segundo filtro en DB.

Aunque el LLM alucine un UUID ajeno, el query devuelve `null`. **Imposible cruzar datos entre barberías.**

---

## 9. Roadmap — lo que queda, ordenado por ratio valor/esfuerzo

### 🥇 Prioridad 1 — UX del chat (no son tools, son mejoras de la UI/endpoint)

1. **Streaming real con `streamText`** (AI SDK v6) + SSE al cliente. Percepción de velocidad ×3. Texto aparece carácter a carácter y tool calls se muestran en vivo.
2. **Foto del día dinámica**. Llamar `get_business_overview` antes del primer turno y meter el resumen en el `situationalSummary` del system prompt. Hoy ese campo está vacío.
3. **Tool call chips en la UI**. Cada tool call = chip con icono + nombre humano + duración + estado. Clickable para ver input/output.
4. **Confirmaciones ricas**. En vez de "¿Lo hago?" en texto, renderizar card con botones [Sí / No / Editar].
5. **Quick actions al abrir el chat**. 4-6 botones según hora/rol: "¿Cómo va el día?", "Pendientes de pago", etc.
6. **Sugerencias de siguiente paso** (chips post-respuesta): tras `find_reactivation_candidates` → "Enviar campaña a los 10", "Exportar CSV".

### 🥈 Prioridad 2 — Tools nuevas de alto impacto

**Marketing & comunicación (gran hueco):**
- `send_message_to_customer` (email/SMS a cliente concreto con template)
- `create_marketing_campaign` (usar la lista de `find_reactivation_candidates`)
- `list_marketing_campaigns` + `get_campaign_stats`
- `toggle_customer_marketing_optin`

**Finanzas:**
- `refund_payment` (reembolso total/parcial via Stripe)
- `list_payouts` + `get_wallet_balance` + `request_payout`
- `get_stripe_status` (onboarding, charges_enabled, payouts_enabled)

**Staff CRUD (completar):**
- `create_staff` / `update_staff` / `deactivate_staff`
- `update_staff_schedule` (cambiar horario recurrente)
- `assign_service_to_staff` / `unassign_service_from_staff`
- `list_staff_services`

### 🥉 Prioridad 3 — tools adicionales

**Agenda avanzada:** `bulk_reschedule_day`, `duplicate_booking`, `list_conflicts`, `waitlist_add/offer`, `find_best_slot_for_customer`.
**Clientes avanzado:** `merge_customers`, `tag_customer`, `set_customer_vip`, `ban_customer`, `list_customer_birthdays_this_month`.
**Servicios:** `deactivate_service`, `bulk_price_update`, `clone_service`, `sync_stripe_prices`.
**Analítica:** `get_occupancy_heatmap`, `get_cancellation_analysis`, `get_revenue_comparison`, `forecast_next_week`.
**Config desde chat:** `update_business_hours`, `update_cancellation_policy`, `toggle_no_show_protection`, `update_asistente_autonomy`.

### 🔧 Pendientes técnicos

- **Task #25 (pending):** Página `Ajustes → IA` con toggle habilitar/deshabilitar asistente (`tenants.asistente_enabled`).
- **Historial de conversaciones lateral** (ya existe tabla `asistente_sessions`). Título autogenerado.
- **Undo visual** 10s tras cada WRITE, ejecutando acción inversa.
- **Regenerar tipos Supabase** con `supabase gen types typescript` para eliminar los `as any` y `as unknown as`.

---

## 10. Contexto adicional que puedes meter en el system prompt

- Nombre del usuario (Josep) y su rol.
- Foto del día dinámica (sección `situationalSummary`, ya hay hook en `buildSystemPrompt`, solo falta rellenarla).
- Últimas 5 acciones del `audit_log` (conciencia de qué pasa en vivo).
- Staff en turno ahora mismo.
- Tabla nueva `tenant_knowledge`: documentos cortos subidos por el owner ("cerramos los martes a las 19h") — RAG ligero o inyección directa.
- Tendencia semanal ("vais un 12% por debajo de la semana anterior").
- Festivos locales + eventos estacionales próximos.

---

## 11. Cómo empezar esta sesión — checklist

Cuando Josep te diga "sigue mejorando el agente" o similar:

1. **Lee** `src/lib/asistente/tools/registry.ts` completo para ver el estado exacto de tools registradas.
2. **Lee** `src/lib/asistente/llm/system-prompt.ts` para la versión actual.
3. **Elige** de qué roadmap atacas (pregunta a Josep si dudas entre UX o tools). Por defecto: continúa por prioridad 2 (marketing tools) si no hay indicación específica.
4. **Verifica schema** de cada tabla que vas a tocar con Supabase MCP antes de escribir código.
5. **Crea** la tool siguiendo la plantilla de la sección 7.
6. **Registra** en `registry.ts` (import + entrada en el objeto).
7. **Actualiza** `system-prompt.ts` si añades una tool que el LLM necesita saber cuándo usar (sube el `SYSTEM_PROMPT_VERSION`).
8. **Typecheck** con `npx tsc --noEmit 2>&1 | grep "src/lib/asistente"`. Debería ser vacío.
9. **Resumen final** para Josep: qué añadiste, dónde, y qué pruebe.

---

## 12. Glosario rápido

- **`ToolRuntimeContext`**: `{ tenantId, userId, userRole, sessionId, ipAddress, userAgent }` — se construye en el endpoint y se pasa a cada `build*Tool(ctx)`.
- **`ToolOutput<T>`**: `ok | err`. `ToolOutputWithPreview<T>` añade `preview`.
- **`withAudit`**: envuelve la ejecución, registra entrada en `asistente_audit_log` con status (ok/denied/pending_confirmation/error), duración, input, summary.
- **RBAC**: `owner(4) > admin(3) > manager(2) > staff(1)`. Usa `hasRoleAtLeast(ctx.userRole, "manager")`. Usa `denyByRole("acción", ctx.userRole)` para rechazar.
- **Estados de booking**: `booking_state` (pending/confirmed/in_progress/completed/cancelled/no_show) + `payment_status` (unpaid/deposit/paid) + legacy `status` (idem pero sin `in_progress`). Al cambiar estado, actualiza los dos — salvo `in_progress`, que solo existe en `booking_state`.
- **Staff blockings.type**: solo `block | absence | vacation`. Detalle semántico va en `reason` (texto libre).

---

## 13. Antipatrones — NO hagas esto

- ❌ `z.string().uuid().describe("tenant_id")` en el schema de una tool.
- ❌ `supabase.from("x").select("*, customer:customers(name)")` sin cast — da `never[]`.
- ❌ `.update({...})` sin `.eq("tenant_id", ctx.tenantId)`.
- ❌ Devolver UUIDs al usuario en el `summary`. Usa nombres.
- ❌ Reintentar una tool fallida en bucle.
- ❌ Crear archivos `.md` de documentación salvo que Josep lo pida.
- ❌ Hacer `git push` desde el sandbox.
- ❌ `git reset --hard` o destructivos sin confirmar.
- ❌ Inventar columnas o tablas. Verifica primero con Supabase MCP.

---

## 14. Mensaje de arranque sugerido para Josep

Cuando empieces sesión nueva, Josep puede mandar algo como:

> "Lee `HANDOFF_IA_AGENT.md` en la raíz de platform y continúa con prioridad 2 — empezamos por las tools de marketing. Antes de codear, verifica el schema de `marketing_campaigns` y pásame el plan."

---

**Fin del handoff.** Trabaja con calma, verifica antes de asumir, y cuando dudes entre dos caminos pregunta en vez de adivinar.
