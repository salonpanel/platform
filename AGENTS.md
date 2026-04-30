# AGENTS.md

## Cursor Cloud specific instructions

### Overview

BookFast Pro is a multi-tenant SaaS for appointment/booking management (beauty salons, barbershops). Stack: Next.js 16 (App Router, Turbopack) + TypeScript + Supabase (cloud) + Stripe + Tailwind 4.

### Supabase — cloud only

Local Supabase (`supabase start`) does **not** work — the migrations in `supabase/migrations/` are out of sync with the cloud schema. Always point to the cloud instance (`https://jsqminbgggwhvkfgeibz.supabase.co`). The required env vars are:

- `NEXT_PUBLIC_SUPABASE_URL` — set to `https://jsqminbgggwhvkfgeibz.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — provided as Cursor Cloud secret
- `SUPABASE_SERVICE_ROLE_KEY` — provided as Cursor Cloud secret

These must be configured in `.env.local` (gitignored). The update script writes them from env vars on startup.

### Common commands

| Task | Command |
|---|---|
| Dev server | `npm run dev` (Turbopack, port 3000) |
| Lint | `npx eslint .` (Next.js 16 removed `next lint`; use ESLint directly) |
| Typecheck | `npm run typecheck` |
| Tests | `npm test` |
| Install deps | `npm install` |

### Gotchas

- **`next lint` does not exist** in Next.js 16. Use `npx eslint .` instead.
- **ESLint**: ~800 pre-existing warnings/errors (mostly `@typescript-eslint/no-explicit-any` and unused vars). These are not regressions.
- **Typecheck**: passes clean.
- **Tests**: integration tests (`overlap-constraint`, `concurrency-*`) require a live Supabase connection and will fail with `ECONNREFUSED` without real keys. Unit tests in `availability-combined.test.ts` pass without Supabase.
- **Dev login**: set `NEXT_PUBLIC_ENABLE_DEV_LOGIN=true` in `.env.local` to enable the `/api/auth/dev-login` endpoint (development only).
- **OTP login for testing**: you can generate an OTP via the Supabase Admin API using the service role key, then navigate directly to `/login/verify-code?email=<email>` and enter the OTP. The normal send-code flow (`/api/auth/send-otp-resend`) may fail locally because Resend email delivery targets production domains.

### Auth flow

The app uses Supabase magic-link / OTP login. The home page (`/`) redirects to `/login`. Use `josep@bookfast.es` as the test account with the cloud Supabase instance. To generate an OTP without sending email:

```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/admin/generate_link" \
  -X POST \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"magiclink","email":"josep@bookfast.es"}'
```

The response includes `email_otp` (8 digits). Navigate to `/login/verify-code?email=josep@bookfast.es` and enter the OTP to login.

### Optional services

Stripe, Upstash Redis, Resend, and LLM providers (Mistral/Anthropic) are optional. The app boots and core features work without them. Rate limiting gracefully degrades if Upstash keys are absent.
