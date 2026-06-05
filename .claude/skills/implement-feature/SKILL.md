---
name: implement-feature
description: Use AFTER design-feature has produced an approved technical design. Triggers on "implement this", "build it", "let's code it". Applies the design end-to-end: schema changes, TypeScript types, pages/components, Supabase queries, i18n keys, route wiring. Stops short of running the dev server / test plan — that's test-feature.
---

# Implement a feature

You have an approved design from design-feature. Execute it carefully, in the right order, following the project's conventions.

## Pre-flight

1. Re-read the design in this conversation. If anything is ambiguous, ask before editing.
2. Use TodoWrite to track the implementation steps below — the user wants visibility into progress on multi-file changes.

## Order of operations

Doing these out of order causes TypeScript errors and broken builds. Stick to the sequence.

### 1. Schema first

- Edit [supabase/schema.sql](supabase/schema.sql) to reflect the design. Append new tables, new columns (with `default`), new views/triggers in the matching section.
- Apply the change against the live Supabase project using MCP `execute_sql` (for iteration) — the project ref is in [.env](.env). Do not use `apply_migration` unless the design explicitly chose that path.
- After applying, run MCP `list_tables` and (if you added views/functions) `get_advisors` to confirm nothing regressed. Address advisor warnings related to your change.

### 2. Types

- Update [src/types/index.ts](src/types/index.ts) per the design diff. Keep snake_case to match the DB.
- If you added a new domain object, export it from this file — every page imports from `../types` (relative) or `@/types` if path aliases exist (they don't in this project — use relative paths).

### 3. Supabase client usage

- All queries go through the shared client in [src/lib/supabase.ts](src/lib/supabase.ts). Do not instantiate a new client.
- Match the existing query style: chained builders, `.eq/.in/.order/.limit`, destructure `{ data, error }`, and bail on `error`.

### 4. Pages & components

- Add new pages under [src/pages/](src/pages/) with PascalCase filenames. Wire the route in [src/App.tsx](src/App.tsx).
- For forms, mirror [src/pages/ImprovementForm.tsx](src/pages/ImprovementForm.tsx): `useForm` + `zodResolver`, field-level errors rendered, submit handler async.
- For lists, mirror [src/pages/Improvements.tsx](src/pages/Improvements.tsx). For detail views, mirror [src/pages/ImprovementDetail.tsx](src/pages/ImprovementDetail.tsx).
- Tailwind v4 utility classes only; no separate CSS files.
- Use lucide-react for icons, date-fns for date formatting, recharts for any chart.

### 5. i18n — both languages

- Add every new key to **both** [src/i18n/en.json](src/i18n/en.json) **and** [src/i18n/es.json](src/i18n/es.json). Match the existing nesting style.
- No hardcoded user-facing strings in components. Use `useTranslation()` and `t('key')`.
- After editing, eyeball both files for the same key set — mismatches cause runtime fallbacks.

### 6. Navigation

- If the new route should appear in the sidebar/header, update [src/components/layout/Layout.tsx](src/components/layout/Layout.tsx).

## Conventions to keep

- **No new dependencies** unless the design called for one. If you think you need one, stop and ask first.
- **No comments** explaining what the code does — names should speak for themselves. Only add a comment when there's a non-obvious why.
- **No defensive try/catch** around Supabase calls — just check `error` and return early or surface it via the existing error rendering pattern.
- **No `any`** in new code. If the Supabase response type is awkward, narrow it explicitly.
- Don't introduce a feature flag or backwards-compat shim. Change the code.

## When you're done

- Run a typecheck to confirm the project still builds: `npm run build` (this runs `tsc -b && vite build`). Do NOT skip — TS 6 + React 19 catches a lot here.
- Run `npm run lint` and fix anything related to your changes.
- Report what you changed and hand off: "Implementation complete — run test-feature to validate."

## Deferred guidance

For deep Supabase questions (RLS, edge functions, advisors output, Postgres extensions), defer to the installed `supabase` skill rather than improvising.
