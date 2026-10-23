# Inkloom AI — Intelligent Brand Governance Platform

Inkloom AI reviews marketing copy against configurable brand rules and gives human reviewers evidence, suggestions, and an auditable decision workflow.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the shared API server under `/api`
- `pnpm --filter @workspace/inkloom-ai run dev` — run the Inkloom frontend
- `pnpm --filter @workspace/api-server run test:inkloom` — run deterministic rules-engine tests
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- SQLite path defaults to `artifacts/api-server/data/inkloom.sqlite`; override with `INKLOOM_DB_PATH`
- Replit workflows provide required `PORT` and `BASE_PATH` values

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + TypeScript
- DB: SQLite through Node.js built-in `node:sqlite`
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/inkloom-ai` — React/Vite dashboard and review workflow
- `artifacts/api-server/src/routes/inkloom.ts` — Inkloom HTTP endpoints
- `artifacts/api-server/src/lib/rules-engine.ts` — deterministic, evidence-producing rules engine
- `artifacts/api-server/src/lib/inkloom-store.ts` — SQLite persistence and audit events
- `artifacts/api-server/config/inkloom-rules.json` — initial sample rules
- `lib/api-spec/openapi.yaml` — API contract source of truth

## Architecture decisions

- The shared backend is Express/TypeScript, so Inkloom uses it instead of introducing a separate Python/FastAPI service.
- SQLite is provided by Node 24's built-in module; sample rules are loaded from JSON into SQLite on first use.
- Review findings are deterministic matches; no LLM or approved-source verification service is connected.
- Review decisions and reasons are append-only audit events in addition to the current status shown on each review.
- This demo has no sign-in or access controls; SQLite data is local and may reset on redeploy.

## Product

Responsive brand-governance dashboard, content analysis, editable brand rules, evidence-based findings, searchable history, review decisions, and audit trail.

## User preferences

Use the provided team identity and keep factual uncertainty, text-only accessibility limits, and visual-demo status explicit in the interface.

## Gotchas

- Update `lib/api-spec/openapi.yaml` first and rerun codegen after API contract changes.
- The JSON file seeds rules only when the SQLite rule table is empty; later edits live in the database.
- Do not treat a detected claim as verified. The app has no approved-source repository.
- Do not submit confidential content to the demo; it has no auth or roles.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
