---
name: design-feature
description: Use AFTER plan-feature, when the user has confirmed the plan and wants the technical design before code is written. Triggers on "design this", "how should we implement X", "what's the schema/types/component shape". Produces the concrete technical design — SQL migration text, TypeScript type diffs, component tree, Supabase query shapes, i18n key list, route changes — but does NOT apply any of it. implement-feature is the next step.
---

# Design a feature

You have an approved plan from plan-feature (or equivalent context). Produce a concrete, reviewable technical design. **Still no code changes, no SQL execution.**

## Inputs you need before starting

- A confirmed feature plan (scope, affected pages/tables).
- The exact rows/columns the feature reads or writes — re-read [supabase/schema.sql](supabase/schema.sql) for anything you're unsure about.

If either is missing, stop and ask. Don't invent.

## Deliverables (write these to chat, one section each)

### 1. Schema design

- **SQL block** in a fenced code block, in the same dialect/style as [supabase/schema.sql](supabase/schema.sql) (lowercase keywords, `uuid_generate_v4()`, `timestamptz` defaults, named constraints).
- New columns must have a sensible `default` so existing rows don't break.
- If you add a column/table that participates in points or leaderboard, also write the trigger/view update. The existing `sync_user_total_points` and `leaderboard_annual` patterns are the references.
- Decision: **inline edit of [supabase/schema.sql](supabase/schema.sql) + re-apply** (simple, no migration history) vs **MCP `apply_migration`** (creates migration entry). State which you'll do and why. Default to inline edit for this project — there's no migrations folder yet.
- **Do not enable RLS** unless the user is also adding auth in this feature. The schema today is auth-less by design.

### 2. TypeScript types

- Show the exact diff to [src/types/index.ts](src/types/index.ts) — new interfaces, new union members, fields added to existing interfaces.
- Match snake_case from the DB; do not rename in TS unless there's a strong reason.

### 3. Component & route tree

- New routes: show the `<Route>` line to add to [src/App.tsx](src/App.tsx).
- New pages: list as `src/pages/<Name>.tsx` with a one-line responsibility.
- New shared components: only propose one if it'll be used in ≥2 places. Otherwise inline.
- Reference how the closest existing page handles the same concern (form, list, detail).

### 4. Data access shapes

- For each Supabase call, write the query shape inline, e.g.:
  ```ts
  supabase.from('improvements').select('id,title,status').eq('area', area)
  ```
- Note any joins (`select('*, users(name)')`), filters, ordering, and whether realtime is needed (default: no).
- If you write into multiple tables, say whether it's wrapped in an RPC or done sequentially client-side. Prefer RPC when there's an invariant to preserve.

### 5. Form & validation (if applicable)

- Zod schema sketch (just the shape, not the full code).
- react-hook-form usage: `useForm<...>({ resolver: zodResolver(schema) })`.
- Mirror the patterns used in [src/pages/ImprovementForm.tsx](src/pages/ImprovementForm.tsx).

### 6. i18n keys

- Bullet list of every new key, with both EN and ES values. Both languages are required — don't ship EN-only.

### 7. Risks & mitigations

- One line per risk. Especially flag:
  - Anything that changes the totals on the leaderboard
  - Anything that touches `point_assignments` or its trigger
  - Views (`dashboard_metrics`, `leaderboard_annual`) that need to be recreated

### 8. Acceptance criteria

- 3–6 bullets, each independently verifiable. test-feature will use these.

## Hand-off

Finish with: "Ready to implement — run implement-feature with this design." Do not start editing files in this step.

## Deferred guidance

For Supabase-specific concerns beyond what's here (extensions, edge functions, advisors, security audits), defer to the `supabase` skill that's already installed in this project rather than duplicating its content.
