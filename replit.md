# Sparky

Sparky helps learners build projects with AI while understanding the coding and CS concepts behind them.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API; use managed workflow (configured service port 8080)
- `pnpm --filter @workspace/sparky run dev` — frontend; start using its managed workflow for the configured port/base path
- `pnpm --filter @workspace/api-server test` — proxy-based server acceptance tests; `RUN_LIVE_AI=1` additionally asserts real provider success
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- Frontend: `artifacts/sparky/src`
- Backend: `artifacts/api-server/src/routes/projects.ts`, `lib/run-engine.ts`, `lib/ai.ts`, `lib/store.ts`
- Database: `lib/db/src/schema/sparky.ts`; migrations in `lib/db/drizzle`
- Contract: `lib/api-spec/openapi.yaml`
- Complete setup, demo script, security, and verification limitations: `README.md`

## Architecture decisions

- Adapt the inspected Next.js repository to the provided Vite/Express artifact architecture rather than keeping duplicate servers. **Why:** shared routing and production workflows already support this split.
- Use secure opaque guest sessions, not local password authentication. **Why:** the brief explicitly permits a no-signup public demo and requires visitor isolation.
- Keep the sample plan explicitly curated and all real tutoring provider-backed. **Why:** challenge evidence must never confuse prerecorded guidance with live AI.
- Record browser receipt and display acknowledgement as server-observed boundaries, not invented browser/network timings. **Why:** the challenge requires truthful measured events.
- Preserve run inputs on failure and retry the same run. **Why:** learner work and message/result identity must survive interruption.

## Product

Project onboarding, expense-tracker sample, AI-generated custom plans, task concepts and completion, autosaved code/question drafts, hint/explanation/solution tutoring, and live persisted request tracing with safe failure controls. “Collaborative” means learner + AI, not multiplayer.

## User preferences

- Preserve useful behavior from `sujaysun101/ai-coding-tutor`; inspect source rather than trusting its scaffold README.
- Never execute learner code on the application server.
- No multiplayer, LMS, payments, or code-execution expansion before the main flow works.
- Never claim a provider success, test, or deployment that did not happen.

## Gotchas

- Managed Anthropic is provisioned. Live server acceptance checks pass, including custom plans and real tutoring after simulated failure; browser-interactive checks remain outstanding.
- Replit AI Integrations for Anthropic bills usage to Replit credits, without a personal API key.
- Migrations apply to development through Drizzle and to managed production through Publish; never add startup DDL.
- Production configuration belongs to each artifact; do not create replacement workflows.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
