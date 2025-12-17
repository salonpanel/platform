# BookFast Pro – Database Rebuild Guide

This guide explains how to fully rebuild the local database using the approved baseline and keep it in sync with Supabase Cloud.

## Prerequisites
- Supabase CLI installed and authenticated
- Docker running (for local Supabase stack)
- Workspace at: C:/Users/Josep Calafat/Documents/GitHub/platform

## Files
- Baseline: supabase/migrations/0000_full_baseline.sql
- Local seed: supabase/seed_local.sql (non-production helpers)

## Rebuild Process
1. Start local stack (if needed):
```bash
supabase start
```
2. Reset and apply baseline only:
```bash
supabase db reset
```
3. (Optional) Apply local seed helpers:
```bash
supabase db execute --file supabase/seed_local.sql
```

## Order of Migrations
- 0000_full_baseline.sql must run first.
- Future migrations should be additive, small, and ordered.

## Sync with Supabase Cloud
- Use `supabase db diff` to compare local vs cloud.
- Avoid exporting Supabase-managed schemas (`auth`, `storage`) into baseline.
- Promote only baseline-compatible changes to Cloud.

## Roles, Permissions, and RLS
- app.* functions (current_tenant_id, user_has_role, get_tenant_timezone) must exist before RLS policies.
- Policies rely on these app.* functions and are created after tables and functions.
- platform.* functions must exist before triggers.

## Key Warnings
- Do not include `auth` or `storage` schema contents in baseline – Supabase manages them.
- Exclude duplicate constraints:
  - appointments: fk_appointments_customer
  - appointments: fk_customer
  - staff_provides_services: fk_service
  - bookings: fk_service
- Keep the validated DAG order intact:
  extensions → functions → tables → constraints → indexes → triggers → policies → comments

## Materialized Views
- Created WITH NO DATA in baseline.
- Refresh in local dev using seed_local.sql after inserting demo data.
- Optional indexes for mat views belong in seed_local.sql, not baseline.

## Troubleshooting
- If `EXCLUDE USING gist` errors: ensure `btree_gist` extension exists (baseline does this early).
- If policies error: verify app.* functions exist and search_path is correct.
- If triggers error: verify platform.* functions exist.

## Future Workflow
- Keep baseline immutable; add new changes via versioned migrations.
- Document each migration’s intent and rollback plan.

## Official Migration Policy
- Prohibited: manual edits to the production database schema or data paths outside approved migrations.
- Required: every future change must be implemented as a new incremental migration file (e.g., 0001_feature.sql, 0002_fix.sql), applied in order.
- Never regenerate the baseline: `supabase/migrations/0000_full_baseline.sql` is frozen and must not be modified.
- Baseline immutability is a project rule (not a recommendation). Any deviation must be reverted and re-done via proper incremental migration.

## Source of Truth Alignment
- Baseline reflects the certified cloud state as of approval date.
- Repository is the single source of truth. Cloud is the executed environment.
- Changes must originate in the repo and be applied to cloud via migrations; cloud must not diverge.

---
Maintainer: GitHub Copilot (Architectural Assistant)
Approved: 2025-12-12