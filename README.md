# Inkloom AI — Intelligent Brand Governance Platform

Inkloom helps marketing teams review copy against configurable brand rules before publication. Each text-rule signal includes the matching evidence, explanation, applicable rule, and an optional suggested edit. A human reviewer records the final status and reason.

## Team

- **Team:** MUQLISEEN00
- **Team leader:** Muqliseen
- **Team members:** Gagagana B J and Meghana K

## Features in this demo

- Overview with review, status, finding, and activity summaries
- Content submission and deterministic checks against enabled brand rules
- Evidence-backed findings for matched text, with severity, rule, explanation, and suggestion
- Human decisions: Approved, Needs Changes, or Dismissed; reviewer and reason are required
- Searchable review history, review detail, and per-review audit events
- Editable rule library for tone, terminology, prohibited claims, approved messaging, disclaimers, accessibility, and visual guidance
- Sample approved-logo reference card, clearly labeled as a demo
- Responsive React and TypeScript interface
- SQLite persistence for reviews, rules, decisions, and audit events

## Run in Replit

Use the configured **API Server** and **Inkloom AI** workflows. The API is served under `/api`; the frontend runs at the project root.

For a local checkout, install workspace dependencies with `pnpm install`, then run the API and web packages using their `dev` scripts. The Replit workflows provide the required `PORT` and `BASE_PATH` values.

## Data and rules

- The initial rule set is in `artifacts/api-server/config/inkloom-rules.json`.
- The API copies those rules into SQLite on first start. Subsequent edits through the UI are stored in SQLite.
- The SQLite path defaults to `artifacts/api-server/data/inkloom.sqlite`; set `INKLOOM_DB_PATH` to override it.
- `pattern` values are case-insensitive literal phrases separated by `|`, not regular expressions.
- The initial sample review is seeded only when the database contains no reviews.
- Local database files are excluded from Git and the deployment image. Published demo data can reset after a redeploy; use a persistent volume or migrate to PostgreSQL before relying on production data.

## Checks and tests

```sh
pnpm --filter @workspace/api-server run test:inkloom
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/inkloom-ai run typecheck
pnpm run typecheck
```

The rules-engine tests cover exact evidence, terminology correction, unverified claims, disclaimer checks, generic link text, all-caps copy, and clean content.

## Important limitations

- **Not Python/FastAPI:** This workspace is scaffolded around a shared Express and TypeScript API. Inkloom uses that supported service with Node's built-in SQLite module instead of adding a second Python server. The governance engine is modular TypeScript and the initial rules are JSON-configured.
- **No LLM is connected:** findings come from deterministic text matches; the app does not infer tone or meaning beyond configured patterns.
- **Claims are not verified:** there is no approved-source repository or citation verification integration. A matching claim is a signal for human evidence review, not confirmation that it is true or false.
- **Accessibility checks are text-only:** they do not inspect rendered contrast, image alternatives, semantic structure, keyboard behavior, or assistive-technology output.
- **Visual asset checks are a demo:** the sample logo card is only a reference; image upload and pixel-level comparison are not implemented.
- **No sign-in or roles:** this hackathon demo is not access-controlled. Do not submit confidential marketing content.
- **Production storage:** SQLite is suitable for a single-instance demo. Configure durable storage or migrate to a managed database before relying on published review history.

## Source layout

- `artifacts/inkloom-ai` — React/Vite frontend
- `artifacts/api-server` — Express API, SQLite store, and rules engine
- `artifacts/api-server/config/inkloom-rules.json` — sample rules loaded into a fresh SQLite database
- `lib/api-spec/openapi.yaml` — API contract; generated hooks and schemas live in `lib/api-client-react` and `lib/api-zod`
