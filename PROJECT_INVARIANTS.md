# PROJECT INVARIANTS – DO NOT BREAK

These rules are absolute unless the user explicitly says otherwise.

## 🔒 DO NOT MODIFY WITHOUT EXPLICIT USER APPROVAL

- Supabase migrations already applied in production
- RLS policies unless explicitly requested
- Stripe / billing logic
- Authentication flows (login, signup, session handling)
- Any file under /supabase/migrations unless instructed

## 🧠 ARCHITECTURAL ASSUMPTIONS

- This is a Next.js app using Turbopack in dev
- TypeScript errors are considered build-breaking
- Lint errors must not be ignored
- The app must always boot with `npm run dev`

## ⚠️ SAFE-CHECK RULE

After any non-trivial change:

- Run `scripts/safe-check.sh`
- If it fails: stop and report, do not continue

## 🧪 TESTING POLICY

- Unit tests: allowed when logic changes
- Integration tests: only when backend logic changes
- Supabase destructive commands: NEVER automatic

## 🛑 FAILURE MODE

If unsure:

- Do not guess
- Ask the user

## 🤖 AGENT BEHAVIOR

- Prefer reading existing docs before scanning files
- Prefer minimal diffs over refactors
- If instructions are ambiguous: pause and ask
