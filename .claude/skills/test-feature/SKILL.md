---
name: test-feature
description: Use AFTER implement-feature. Triggers on "test this", "validate the feature", "does it work", "smoke test". Runs build/lint, starts the Vite dev server, and produces a manual smoke-test plan tied to the design's acceptance criteria. There is no automated test framework in this project yet — this skill is honest about that and focuses on what CAN be verified.
---

# Test a feature

There is no Vitest / Jest / Playwright setup in this project (see [package.json](package.json) — only `dev`, `build`, `lint`, `preview`). Don't fabricate test runs that didn't happen. Focus on what's actually verifiable.

## What you CAN run

1. **TypeScript + production build**
   ```
   npm run build
   ```
   Runs `tsc -b && vite build`. This is your strongest automated signal. Fix every error before moving on — don't suppress with `// @ts-expect-error` or `as any`.

2. **Lint**
   ```
   npm run lint
   ```
   Address warnings introduced by this feature. Pre-existing warnings are not your problem unless the user asked for cleanup.

3. **Dev server smoke test**
   ```
   npm run dev
   ```
   Start it in the background, then open the relevant route in a browser. Walk the golden path and at least 2 edge cases. Watch the dev-tools console for warnings (React 19 surfaces a lot of hydration/effect warnings).

4. **Supabase-side checks** (via MCP)
   - `list_tables` — confirm schema changes landed
   - `execute_sql` with a `select` against new/changed tables to verify defaults, triggers, and computed columns behave
   - `get_advisors` — review and address anything new caused by this feature
   - `get_logs` — only if something misbehaves in step 3

## Manual smoke-test plan

Generate this for the user, mapped 1:1 to the acceptance criteria from the design. Use the format:

```
## Smoke test — <feature name>

Golden path
1. [ ] Step the user takes → expected visible result
2. [ ] ...

Edge cases
- [ ] Empty state — what should render
- [ ] Validation — what should fail and how
- [ ] i18n — switch language, confirm both EN and ES render

Data integrity
- [ ] Run <SQL> in Supabase → expected row state
- [ ] Confirm leaderboard / dashboard_metrics totals still match (if relevant)
```

Keep it actionable. Each box must be something the user can check off in < 60 seconds.

## i18n parity check

After the build passes, do a quick parity scan:

- Open [src/i18n/en.json](src/i18n/en.json) and [src/i18n/es.json](src/i18n/es.json) side-by-side
- Confirm every key added in implementation exists in both files
- Mismatches won't fail the build, but they will silently fall back at runtime

## Honesty rules

- Never report "tests pass" if all you did was a build. Say what you actually ran.
- If the UI couldn't be verified (no browser available in this environment), say so plainly and ask the user to walk the smoke plan themselves.
- If `npm run build` fails, do not deliver a smoke plan — fix the build first.

## Hand-off

End with a one-line status: what passed, what's outstanding, and what the user needs to manually verify. No emojis, no celebrations.
