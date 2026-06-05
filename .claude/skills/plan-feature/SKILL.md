---
name: plan-feature
description: Use at the START of shipping a new feature in this continuous-improvement-app (React 19 + Supabase). Triggers on phrases like "I want to add X", "let's plan feature Y", "we need a new page for Z", "ship a new improvement workflow step". Produces a written feature plan covering user stories, affected pages/tables/types/i18n, scope cuts, and open questions. Stops before any code or schema change — design-feature is the next step.
---

# Plan a feature

You are scoping a new feature for the continuous-improvement-app. Goal: produce a short, decision-ready plan, **not code**.

## Project quick-context (don't re-derive)

- React 19 + Vite 8 + TS 6, Tailwind v4 (`@tailwindcss/vite`)
- Supabase JS 2.x. Client at [src/lib/supabase.ts](src/lib/supabase.ts). No auth, no RLS yet — see [supabase/schema.sql](supabase/schema.sql) tail
- Pages in [src/pages/](src/pages/), shared layout in [src/components/layout/Layout.tsx](src/components/layout/Layout.tsx)
- Types in [src/types/index.ts](src/types/index.ts) — single source of truth
- Forms: react-hook-form + Zod (`@hookform/resolvers`)
- i18n: i18next, with [src/i18n/en.json](src/i18n/en.json) and [src/i18n/es.json](src/i18n/es.json) — **both must stay in sync**
- Charts: recharts. Icons: lucide-react. Dates: date-fns
- Routing: react-router-dom v7 in [src/App.tsx](src/App.tsx)
- Domain model: users → improvements (11-step PDCA workflow) → point_assignments → leaderboard. Read [supabase/schema.sql](supabase/schema.sql) before scoping anything that touches data.

## Steps

1. **Clarify the feature in one paragraph.** If the user's request is fuzzy ("add notifications"), ask up to 3 sharp questions before writing the plan. Don't write a plan for the wrong feature.

2. **Read what already exists.** Skim the page(s) closest to the feature (likely `src/pages/*.tsx`) and the relevant columns in [supabase/schema.sql](supabase/schema.sql). Cite file:line references for anything you'll touch.

3. **Write the plan** to chat (no files). Use these sections, kept tight:

   - **User story** — one or two sentences, in the user's voice
   - **Affected pages/routes** — list paths from [src/App.tsx](src/App.tsx) and any new route
   - **Schema impact** — tables/columns/views/triggers added or changed, with reference to existing patterns (e.g., the `updated_at` trigger, the `sync_user_total_points` pattern). Flag if the existing `leaderboard_annual` view or `dashboard_metrics` view needs updating.
   - **Type changes** — what gets added to [src/types/index.ts](src/types/index.ts)
   - **i18n keys** — list new keys needed in BOTH `en.json` and `es.json`
   - **Out of scope** — the explicit cuts. Be aggressive here.
   - **Open questions** — anything you couldn't answer from the code

4. **Stop.** Ask the user to confirm or redirect before moving to design-feature. Do not write code, do not run SQL, do not edit files.

## Quality bar

- The plan must be specific enough that design-feature can run without re-asking the user basic questions.
- Every "we'll need X" should name the file or table it lives in.
- If the feature touches points/SQDCM/leaderboard, double-check whether [supabase/schema.sql](supabase/schema.sql) triggers or views need to change — getting this wrong silently breaks the leaderboard.
- Plans longer than ~30 lines usually mean the scope is too big. Suggest splitting.
