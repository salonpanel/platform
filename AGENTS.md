# AGENTS.md

## Cursor Cloud specific instructions

### Overview

BookFast Pro is a multi-tenant SaaS for appointment/booking management (beauty salons, barbershops). Stack: Next.js 16 (App Router, Turbopack) + TypeScript + Supabase (cloud) + Stripe + Tailwind 4.

### Supabase — cloud only

Local Supabase (`supabase start`) does **not** work — the migrations in `supabase/migrations/` are out of sync with the cloud schema. Always point to the cloud instance (`https://jsqminbgggwhvkfgeibz.supabase.co`). The required env vars are:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

These must be provided as Cursor Cloud secrets before the app can authenticate users.

### Common commands

| Task | Command |
|---|---|
| Dev server | `npm run dev` (Turbopack, port 3000) |
| Lint | `npx eslint .` (Next.js 16 removed `next lint`; use ESLint directly) |
| Typecheck | `npm run typecheck` |
| Tests | `npm test` |
| Install deps | `npm install` |

### Known pre-existing issues

- **ESLint**: ~800 pre-existing warnings/errors (mostly `@typescript-eslint/no-explicit-any` and unused vars). These are not regressions.
- **Typecheck**: passes clean as of this writing.
- **Tests**: some integration tests (`overlap-constraint`, `concurrency-*`) require a live Supabase connection and will fail with `ECONNREFUSED` if Supabase keys are placeholders. Unit tests in `availability-combined.test.ts` pass without Supabase.

### Auth flow

The app uses Supabase magic-link / OTP login. The home page (`/`) redirects to `/login`. A test account (`owner@bookfast.local` / `password123`) exists in the seed data but only works with local Supabase. For cloud, use a real email configured in the Supabase project.

### Optional services

Stripe, Upstash Redis, Resend, and LLM providers (Mistral/Anthropic) are optional. The app boots and core features work without them. Rate limiting gracefully degrades if Upstash keys are absent.
