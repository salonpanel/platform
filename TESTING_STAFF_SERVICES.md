# Testing Staff ⇄ Services Module

This document explains how to test the Staff ⇄ Services relation system, including unit-level checks and full integration tests with Supabase.

## 1. Overview

The Staff ⇄ Services module is built around these core principles:

- **Canonical relation**: `public.staff_provides_services` is the only source of truth for staff–service assignments.
- **Legacy field**: `public.services.staff_only_ids` is derived from the pivot table via `sync_staff_only_ids_from_relations()` and is used only by availability logic.
- **Availability rules**:
  - If `services.staff_only_ids` is `NULL` / empty → *any active staff* providing that service can be used.
  - If `services.staff_only_ids` is non‑empty → only those staff (and `staff.active = true`) are eligible.
- **Bidirectional UI**:
  - Staff detail (`StaffEditModal`) assigns services by calling `updateStaffServices`.
  - Services modal (`ServiceForm` + `ServiciosClient`) assigns staff by calling `updateServiceStaff`.

## 2. Unit tests vs integration tests

### 2.1 Unit / light integration (no live Supabase required)

These tests run purely in Node/Jest and either:

- Mock Supabase, or
- Use pure TypeScript helpers.

**Command:**

```bash
npm test
```

Notes:

- `jest.config.js` is configured to **ignore heavy integration suites** that require live Supabase/Stripe/Upstash:
  - `tests/rls.test.ts`
  - `tests/rls-integration.test.ts`
  - `tests/rls-complete.test.ts`
  - `tests/webhook-idempotency.test.ts`
  - `tests/rate-limit.test.ts`
- The intent is that `npm test` remains fast and self‑contained.

### 2.2 Full integration tests (Supabase required)

These suites talk to a real Supabase instance using `@supabase/supabase-js` and exercise **RLS policies, constraints, and availability** end‑to‑end.

**Prerequisites:**

- A running Supabase project with the full migration set applied (including `0104`, `0106`, `0108`/`0110`/`0111`, and `0112_staff_services_rls_membership_restore.sql`).
- Environment variables set (locally or via `.env`):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- The tests will create demo tenants, memberships, staff, services, and bookings as needed.

**Commands:**

```bash
# RLS validation helper (SQL‑driven, via service role)
npm run test:rls

# Focused RLS + bookings overlap integration suites
npm run test:integration
```

`npm run test:integration` executes:

- `tests/rls-executable.test.ts`
- `tests/overlap-constraint.test.ts`

These suites expect to be able to reach Supabase over HTTP. If `fetch` fails (e.g. network/firewall issues), they will fail with `TypeError: fetch failed` even if the database is correctly configured.

## 3. Tests touching Staff ⇄ Services and availability

### 3.1 Database‑level

The following migrations define and enforce the Staff ⇄ Services behaviour:

- `0104_services_staff_only_ids.sql`
  - Adds `services.staff_only_ids uuid[]` and a GIN index.
- `0106_services_staff_only_ids_availability_fix.sql`
  - Defines `public.get_available_slots(...)` and applies the `staff_only_ids` filter:
    - If `staff_only_ids` is non‑empty → schedules are restricted to `s.staff_id = ANY(staff_only_ids)`.
    - Otherwise, it uses `staff.provides_services = true` as the default.
- `0108_staff_provides_services_canonical.sql` / `0110_staff_provides_services_jwt_rls.sql` / `0111_staff_services_rls_complete_fix.sql`
  - Create `public.staff_provides_services`.
  - Migrate existing `services.staff_only_ids` into the pivot table.
  - Define `sync_staff_only_ids_from_relations()`:

    ```sql
    update public.services
    set staff_only_ids = coalesce(
      (
        select array_agg(sps.staff_id order by sps.staff_id)
        from public.staff_provides_services sps
        where sps.service_id = services.id
          and sps.tenant_id = services.tenant_id
      ),
      null
    )
    where tenant_id in (
      select distinct tenant_id
      from public.staff_provides_services
    );
    ```

- `0112_staff_services_rls_membership_restore.sql`
  - Restores **membership‑based RLS** for:
    - `public.staff`
    - `public.services`
    - `public.bookings`
    - `public.staff_provides_services`
  - Ensures owners/admins are the only roles allowed to modify `staff_provides_services`.

### 3.2 TypeScript helpers

`src/lib/staff/staffServicesRelations.ts`:

- `updateStaffServices(tenantId, staffId, newServiceIds)`
- `updateServiceStaff(tenantId, serviceId, newStaffIds)`
- `getStaffServices(staffId, tenantId)`
- `getServiceStaff(serviceId, tenantId)`

Both update helpers call `syncStaffOnlyIds(tenantId)`, which runs:

```ts
await supabase.rpc("sync_staff_only_ids_from_relations");
```

This ensures the legacy `services.staff_only_ids` stays in sync with the pivot table for availability.

`app/api/availability/route.ts`:

- Public endpoint used by the booking widget and Agenda.
- Validates:
  - Tenant (by id or slug).
  - Service (`active = true` and belongs to the tenant).
  - Optional staff (`active = true` and belongs to the same tenant).
- Calls SQL function:

```ts
const { data: slots } = await supabase.rpc("get_available_slots", {
  p_tenant_id: tenantId,
  p_service_id: serviceId,
  p_staff_id: staffId || null,
  p_date: date || today,
  p_days_ahead: daysAhead ?? 30,
});
```

The semantics of `get_available_slots` (from `0106`):

- Pulls `services.staff_only_ids` for the requested service.
- If `staff_only_ids` is **non‑empty**:
  - only schedules where `staff_schedules.staff_id = ANY(staff_only_ids)` are considered.
- If `staff_only_ids` is `NULL` / empty:
  - schedules are filtered by `staff.provides_services = true`.
- In all cases, only `staff.active = true` and `staff_schedules.is_active = true` are used.

### 3.3 API safeguards (no direct writes to staff_only_ids)

UIs and APIs must **not** write `services.staff_only_ids` directly.

- `app/panel/servicios/ServiciosClient.tsx`
  - Sends only core service fields (name, duration, buffer, price, category, pricing_levels) to `/api/services` and `/api/services/[id]`.
  - Handles staff assignments separately via `updateServiceStaff` which writes to `staff_provides_services` and then triggers `sync_staff_only_ids_from_relations()`.

- `app/api/services/route.ts` (`POST /api/services`)
  - No longer accepts or inserts `staff_only_ids`.

- `app/api/services/[id]/route.ts` (`PATCH /api/services/[id]`)
  - No longer accepts or updates `staff_only_ids`.

The **only** mechanism that updates `services.staff_only_ids` is the `sync_staff_only_ids_from_relations()` function.

## 4. Manual UI checks

After running migrations and starting the app:

1. **Staff list & detail** (`/panel/staff`)
   - Open Staff detail modal.
   - Verify services are listed and assignments match `staff_provides_services`.
   - Assign/unassign services and save.
   - Confirm that:
     - `staff_provides_services` rows reflect the change.
     - `services.staff_only_ids` is updated via `sync_staff_only_ids_from_relations()`.

2. **Services list & modal** (`/panel/servicios`)
   - Edit a service and open the staff assignment section.
   - Verify all staff (active + inactive) appear.
   - Checkboxes must match `staff_provides_services`.
   - Change assignments and save.
   - Confirm that:
     - Staff detail modal for each staff reflects the new assignment.

3. **Availability** (`/api/availability`)
   - For a given tenant and service:
     - With `staff_only_ids` empty (no pivot rows) → all active staff with `provides_services = true` can appear.
     - With `staff_only_ids` containing a subset of staff IDs → only those staff appear in slots.

## 5. Troubleshooting

- If `npm test` fails with `TypeError: fetch failed` inside `tests/rls-executable.test.ts` or `tests/overlap-constraint.test.ts`:
  - Ensure Supabase is reachable from your environment (correct URL, port, and network access).
  - Alternatively, run only unit tests (`npm test`) and defer `npm run test:integration` to an environment that can reach Supabase.

- If availability behaves unexpectedly:
  - Check `public.staff_provides_services` for the service.
  - Run `select sync_staff_only_ids_from_relations();` manually to resync.
  - Inspect the value of `services.staff_only_ids` and re‑run `/api/availability` for that service.
