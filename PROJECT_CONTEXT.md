# PROJECT CONTEXT (HOT LOAD)

## What this project is

- Next.js app (v16) with Turbopack in dev
- WSL-first development environment
- Node 20 via nvm
- Supabase backend (RLS, migrations, RPCs)
- Stripe billing, Resend email

## How work is done

- Planning happens in ChatGPT
- Execution happens in Antigravity
- Backend actions may run via MCP servers
- After non-trivial changes, run scripts/safe-check.sh

## What matters most

- Stability > clever refactors
- Never break auth, billing, RLS
- Always keep dev bootable with `npm run dev`

## Default commands

- Dev: `npm run dev`
- Typecheck: `npm run typecheck`
- Safety: `scripts/safe-check.sh`
