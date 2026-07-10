---
name: Typecheck & stale generated types
description: How zero-TS-errors is maintained given the stale orval-generated API client
---

# Typecheck conventions

- The orval-generated client (`lib/api-client-react`, from `lib/api-spec/openapi.yaml`) is STALE: the API returns fields (VAT fields, totalNetSales, grossSales, monthly fixed-cost totals) missing from generated types. Do NOT regenerate blindly — the hand-maintained openapi.yaml is the stale source, so regeneration won't add the fields.
- Convention for missing fields: local type extensions + cast at the data-entry point, e.g. `PLExtra` in Reports.tsx and `FixedCostTemplateX`/`MonthlyDataX` in Expenses.tsx. Follow this pattern rather than `as any` on data.
- react-query option objects (`{ query: { enabled } }`) fail the generated `UseQueryOptions` (queryKey required); the accepted pattern is a targeted `as any` cast with an eslint-disable comment.
- api-server tsconfig sets `noImplicitReturns: false` (Express handlers trip TS7030 en masse); base tsconfig keeps it on for everything else.
- `lib/api-zod/src/index.ts` needs the explicit value-only re-export block to resolve TS2308 ambiguity between generated zod values and same-named types — keep it if regenerating.
- **Why:** Root `pnpm build` runs typecheck first, so any new TS error breaks the Railway build.
- **How to apply:** Run `pnpm run typecheck` before pushing; if a new API field is missing from generated types, extend locally per the PLExtra pattern (long-term fix: update openapi.yaml + regenerate).
