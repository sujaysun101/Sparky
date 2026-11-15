# AI Coding Tutor

This repository keeps the root Next.js AI Coding Tutor app alongside the Sparky learning companion workspace.

## Root Next.js app

Run the app with pnpm:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Edit `app/page.tsx` to change the page. The app uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to load Geist.

See the [Next.js documentation](https://nextjs.org/docs) and [deployment guide](https://nextjs.org/docs/app/building-your-application/deploying). The root app can be deployed on [Vercel](https://vercel.com/new?filter=next.js).

---

# Sparky

**Build with AI. Understand what you build.**

Sparky is a project-based coding and computer science learning companion. A learner starts with the expense-tracker example or their own idea, works through small tasks, saves code drafts, and asks an AI tutor for hints, explanations, or an explicitly requested solution. A live **How it works** view shows persisted events from the actual server request, not a timed animation.

## Current status

- The app runs in Replit Preview with a real Express server and PostgreSQL database.
- Sample projects, task completion, code/question drafts, guest isolation, simulated failures, persisted events, SSE snapshots, and duplicate-safe retries have been checked against the running server.
- TypeScript, API production build, and frontend production build pass.
- **Live Anthropic is configured through Replit AI Integrations.** Phone verification and managed-provider provisioning are complete.
- Live custom-plan generation and a successful real tutor response after the simulated AI failure passed the acceptance suite. The retry retained its run ID and did not duplicate the learner message or assistant result.
- No app has been published as part of this work.

## Starting repository: inspection and reuse

Source: https://github.com/sujaysun101/ai-coding-tutor
Inspected revision: `06dda815bfbe71982311970054ad8c04c328497f`

The original source was inspected directly, including `app/page.tsx`, `app/api/tutor/route.ts`, `app/layout.tsx`, the package manifest, Next.js configuration, and README. The README was a generic Next.js scaffold, not a product specification.

What was retained/adapted:

- TypeScript and React, Tailwind styling, and the Anthropic SDK.
- Original language choices: JavaScript, Python, TypeScript, HTML/CSS, React, SQL, Java, and C++.
- Beginner, intermediate, and advanced levels; coding questions with optional submitted code.
- Guided, encouraging tutoring and the structured explanation, code example, common mistakes, next learning topics, concepts, and encouragement.

What changed:

- **For Sparky, the original Next.js source was adapted to React + Vite and Express**, using its shared API server and artifact routing. This avoids maintaining a duplicate web server in the provided pnpm environment. The original single-page form was adapted within the Sparky artifact; the root Next.js AI Coding Tutor remains a separate app.
- Default model changed from the upstream Sonnet model to configurable `claude-haiku-4-5`, a smaller model suited to concise tutoring and small project plans.
- Added schema-validated provider output, explicit hint/explain/solution modes, project context, and a required next step.
- Added relational persistence, secure guest sessions, autosave with browser recovery, milestones/tasks, run records, SSE, measured events, failure recovery, and tests.
- Replaced the original greedy JSON extraction with JSON parsing and bounded Zod schemas; malformed output fails visibly.

## Architecture

```text
Browser: React + Vite
  ├─ HTTPS/JSON → Express API (/api)
  │                ├─ guest cookie + request/ownership validation
  │                ├─ PostgreSQL: Drizzle schema + parameterized queries
  │                └─ Anthropic SDK → Replit AI Integrations
  └─ EventSource ← /api/runs/:id/events ← persisted PostgreSQL event snapshots
```

The frontend is a static production bundle; the API is a separate Node process. Both belong to the same project and origin. All runtime state that matters is in PostgreSQL. The in-process run worker is deliberately small; it is not a durable job queue.

### Request lifecycle

1. Express receives the browser request and records server receipt time.
2. The server validates size, mode, guest ownership, selected task, and idempotency.
3. A transaction stores the run, one learner message, and the submitted code snapshot in the run. Initial browser/validation/database events are committed with it.
4. The worker loads the project, selected task, and recent conversation from PostgreSQL.
5. Anthropic generates guidance. Only safe event summaries are exposed in the diagram.
6. The application validates the JSON response and saves one assistant message and terminal run status in a transaction.
7. After the browser renders that saved response, it acknowledges display. The server records that acknowledgement.

Each event has a unique ID, a run ID, an attempt number, measured timestamps, a status, and a safe summary. The browser receipt and display acknowledgement are server observations: **they do not claim to measure client network latency or browser paint time**. Zero-millisecond steps can be real sub-millisecond work rounded to integer milliseconds.

The UI subscribes to named `run` SSE events with full persisted snapshots, with three-second polling while a run is active as fallback. A reconnect rehydrates from the database. Recent runs can be reopened. Pending steps have no made-up timings.

## Storage and session isolation

Schema: `lib/db/src/schema/sparky.ts`

| Table | Purpose |
|---|---|
| `guest_sessions` | SHA-256 hash of a cryptographically random guest token, creation and expiry |
| `projects` | Guest-owned idea, title, language, level, plan source |
| `milestones` | Ordered project milestones |
| `tasks` | Ordered tasks, completion, concept names and relevance |
| `drafts` | Code and question draft with save timestamp |
| `tutor_messages` | User/assistant messages and validated guidance |
| `runs` | Input snapshot, idempotency hash/key, status, attempt, demo provenance |
| `run_events` | Timestamped step records and safe summaries |

The browser receives a 256-bit random `sparky_guest` cookie. It is HttpOnly, SameSite=Lax, Secure on HTTPS, scoped to `/`, and expires in 30 days. Only the token hash is stored. Every project, task, draft, run, retry, display acknowledgement, and event-stream endpoint verifies ownership against the server-derived guest.

No password system or local account authentication was added. The brief explicitly permits secure guest sessions for a public demo. `SESSION_SECRET` is not needed for this opaque, database-backed session design.

**Returning requires the same browser cookie.** Clearing cookies, using private browsing, or changing devices starts a new guest session. There is no cross-device recovery in this MVP. Browser draft backups are scoped to the project ID in localStorage and remain local to that browser profile. Do not use a shared browser profile for sensitive code.

## Setup and configuration

Use Node.js and pnpm in the supplied Replit project.

```sh
pnpm install
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-spec run codegen
```

Start the configured workflows through Replit:

- `artifacts/api-server: API Server`
- `artifacts/sparky: web`

Do not start a competing server at the workspace root. Artifact workflows provide `PORT` and `BASE_PATH`.

### Environment

| Name | Required? | Use |
|---|---|---|
| `DATABASE_URL` | Yes | Replit-provided PostgreSQL connection; server only |
| `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` | For live AI | Provisioned by Replit AI Integrations |
| `AI_INTEGRATIONS_ANTHROPIC_API_KEY` | For live AI | Provisioned by Replit AI Integrations; never sent to browser |
| `ANTHROPIC_MODEL` | Optional | Defaults to `claude-haiku-4-5`; must be a supported integration model |
| `PORT`, `BASE_PATH` | Per service | Supplied by artifact workflows |

**No personal Anthropic key is required.** This app uses Replit AI Integrations, with usage billed to Replit credits. The integration is provisioned in this project. For a fresh project or fork, enable the managed Anthropic integration and complete any verification requested by Replit. Do not paste credentials into chat or source files.

If AI is absent, the server remains usable for the curated sample and persisted editing. Any attempted AI request fails with an explicit setup message. There is no hidden mock provider or prerecorded response.

### Migrations

The generated initial migration and Drizzle metadata are committed under `lib/db/drizzle/`. Development initialization uses `pnpm --filter @workspace/db run push`. After later schema changes, generate a reviewed migration with:

```sh
pnpm --filter @workspace/db exec drizzle-kit generate --config drizzle.config.ts
```

For Replit-managed production PostgreSQL, Publish compares development and production schemas and applies the supported schema update flow. Review any proposed changes in Publish. **There is no startup-time DDL or custom production migration runner.**

## Failure and recovery

### Tutor failures

- The run input and one user message are committed before the provider is called.
- SDK retries are disabled. The application retries only connection/timeouts, HTTP 429, and provider 5xx errors, with at most two automatic retries after 1s and 2s backoff.
- Provider calls have a 45-second timeout per attempt. Validation/configuration/malformed-output errors are not automatically retried.
- Each failed or retrying provider attempt is represented by an event.
- Retry uses the original run and its stored input; it does not reinsert a learner message.
- Manual retry is capped at five total run attempts.
- A failed database write never produces a success response. If terminal-state persistence itself is unavailable, stale-run recovery handles the interrupted run once storage recovers.

### Idempotency

The client generates a key for each logical send. PostgreSQL enforces uniqueness on `(project_id, idempotency_key)` and `(run_id, role)` for messages. A transaction protected by a guest-level advisory lock checks duplicate requests and capacity. A matching repeat returns the existing run; the same key with different input returns 409. Retrying a completed/running run does not start a second worker. Duplicate display acknowledgements produce one display event.

If delivery is uncertain, the client reuses the key only for identical question, code, mode, task, and simulation setting. A changed request gets a new key.

### Draft saves

Edits are backed up in localStorage immediately and saved after a short debounce. Saves are serialized so older slow saves do not finish after newer saves. The UI distinguishes saving, saved, local backup, and save failure, and offers Retry save.

**Simulate save failure** executes a deliberate divide-by-zero query after the draft update inside its transaction. PostgreSQL rolls that transaction back. It does not delete or damage existing data. The browser retains the unsaved text. Turn off the checkbox and retry.

### AI failure demo

**Simulate AI failure** throws a controlled application error at the actual AI step, before external provider use. It is marked as a demo in the run and does not affect other visitors. Retry disables the simulation for that attempt and calls the real provider. Success still requires a configured, available provider.

### Interrupted requests

A persisted running request older than three minutes is marked interrupted when its workspace, run, or stream is read. Active step events are closed as failed, with a retry instruction. This avoids claiming an abandoned worker is still running forever. Recovery is observation-driven, not an always-on job scheduler.

## Safety and limits

- Learner code is never executed by the application.
- React renders responses as text, including code examples. No raw HTML/markdown injection is used.
- Server validation bounds idea/question/code sizes, enum values, and AI output arrays/text.
- Request JSON limit: 64 KB. Code limit: 30,000 characters. Question limit: 4,000 characters.
- PostgreSQL connections time out after 5s; individual statements after 10s.
- Public demo: 10 projects per guest; 15 tutor sends per 10 minutes per guest; two active runs per guest; 300 API requests per minute per IP/process.
- Cross-site mutations are rejected using origin/fetch-site checks. The API does not enable cross-origin credential access.
- Prompts, submitted code, credentials, and cookies are excluded from trace summaries and application error logs. Input code/messages are private persisted application data, not public trace output.
- Hint and explain responses omit the dedicated code-example field; the provider is instructed not to provide full solutions except in solution mode. A semantic guarantee about arbitrary natural-language AI output is not possible; all guidance is labeled as needing verification.

## Tests and verification

With the API workflow running:

```sh
pnpm run typecheck
pnpm --filter @workspace/api-server test
pnpm --filter @workspace/api-server run build
PORT=23498 BASE_PATH=/ pnpm --filter @workspace/sparky run build
```

The frontend build command above supplies the currently assigned development service values for a manual shell build; normal workflow and Publish builds supply their own configuration.

After AI integration is configured:

```sh
RUN_LIVE_AI=1 pnpm --filter @workspace/api-server test
```

This consumes real provider usage. The live flag asserts successful retry, one assistant reply, duplicate-safe display acknowledgement, and live custom project planning. Without it, those success assertions are deliberately not made.

Recorded checks:

- 9 passing Node test results (one parent, seven acceptance subtests, and one live custom-project test), no failures and no skips, with `RUN_LIVE_AI=1`.
- Sample creation, persisted plan/draft/task state, actual database-error rollback, retry save, cross-guest denial, input limits, cross-site write rejection, actual simulated AI failure, persisted timestamps, SSE snapshots, idempotency conflicts, and retry without duplicated learner messages pass.
- TypeScript and both production builds pass.
- Desktop and mobile landing layouts were visually checked.
- Browser-interactive workspace/autosave/diagram behavior has **not** been end-to-end tested. The API checks and frontend state review do not substitute for that.
- Live custom-plan generation, successful real tutoring after a controlled simulated failure, same-run recovery without duplicate messages, and duplicate-safe display acknowledgement passed.
- Browser-based tutoring interactions, a real external provider outage, malformed provider response handling against a live provider, and pedagogical quality across varied projects remain unverified. The automated display acknowledgement checks the endpoint, not actual browser paint.

Tests use independent guest sessions and communicate through the shared proxy at `http://localhost:80/api`. Their projects do not appear in another visitor's session.

## Demo script

After configuring AI:

1. Open Sparky and choose **Sample: Expense tracker**. Explain that its plan is a curated example, not a live AI-generated plan.
2. Open the first task, enter an expense object, and wait for **Saved**.
3. Ask “How should I calculate total spending without changing the original list?” in **Hint** mode.
4. Open **How it works**. Show the unique run ID, real statuses/timings, and a clicked step’s safe summary. Point out that the reply was saved before display.
5. Refresh. Show the project, draft, messages, task progress, and recorded run.
6. Enable **Simulate AI failure**, send a question, and show the failed Anthropic step. The message and code remain intact.
7. Click **Retry run**. Show the same run ID, the second attempt, and one learner message, followed by a real provider response.
8. Edit code with **Simulate save failure** enabled. Show the explicit unsaved state. Disable it and click **Retry save**.
9. Open another browser profile. The original project is inaccessible in that profile.
10. On a narrow screen, use **Plan / Code / Tutor / How** tabs.

The real provider is configured and the live API flow has passed. Before presenting the demo publicly, rehearse the browser interactions on desktop and mobile; those interactions have not yet been end-to-end tested.

## Publishing

The app includes artifact production configuration for the static frontend and real API process. Publishing must include both services, PostgreSQL, and the AI integration environment. The API startup health route is `/api/healthz`.

1. Confirm the managed AI integration is included in the publishing configuration; live development checks already pass.
2. Open Publish, review the server/frontend services and database schema changes.
3. Publish through Replit. Do not use a static-only deployment for the whole app: the API process is required.
4. On the published URL, repeat sample creation, tutor success, refresh, simulated failure/retry, and guest-isolation checks.

No production URL is claimed here because the app has not been published.

## Known MVP limits

- Guest access is browser-bound, with no login or cross-device recovery.
- The run worker is in-process, not a durable queue. A process restart can interrupt a request; persisted state and retry recover it rather than silently replaying it.
- IP limiting is process-local; guest run limits use PostgreSQL. Distributed global abuse protection and account-level quotas would be needed for a larger public launch.
- Draft recovery handles a single active editor; simultaneous tabs are not a collaborative editing system.
- No arbitrary code execution, multiplayer editing, payments, full LMS, or production analytics.
- The initial sample is one expense-tracker plan. Other projects need live AI.

## Main files

- `artifacts/sparky/`: React frontend, workspace, tutor, editor, and trace components.
- `artifacts/api-server/src/routes/projects.ts`: validated project/run endpoints.
- `artifacts/api-server/src/lib/run-engine.ts`: actual tutor lifecycle and bounded retries.
- `artifacts/api-server/src/lib/ai.ts`: Anthropic calls and output schemas.
- `artifacts/api-server/src/lib/store.ts`: transactions, ownership, persisted views, interrupted-run recovery.
- `lib/api-spec/openapi.yaml`: API source of truth; regenerate clients after changes.
- `lib/db/src/schema/sparky.ts`, `lib/db/drizzle/`: schema and initial migration.
- `artifacts/api-server/tests/acceptance.test.mjs`: executable server acceptance checks.
