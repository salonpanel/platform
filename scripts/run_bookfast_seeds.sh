#!/usr/bin/env bash
set -euo pipefail

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "SUPABASE_DB_URL env var not set. Export it (postgres://user:pass@host:port/dbname)" >&2
  exit 2
fi

echo "Running supabase/seed_bookfast_demo.sql"
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed_bookfast_demo.sql

echo "Running supabase/seed_bookfast_assign_users.sql"
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed_bookfast_assign_users.sql

echo "Running supabase/seed_bookfast_bookings.sql"
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed_bookfast_bookings.sql

echo "Validation: total bookings"
psql "$SUPABASE_DB_URL" -t -c "SELECT COUNT(*) FROM public.bookings WHERE tenant_id = '00000000-0000-0000-0000-000000000001';"

echo "Done."
