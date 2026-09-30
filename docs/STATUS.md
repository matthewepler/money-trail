# STATUS

> Read this first when resuming. Update it when an increment lands or a session ends.
> Keep it under a page — details belong in `BACKLOG.md` or `DECISIONS.md`.

**Last updated:** 2026-09-29 (repo tooling scaffolded)
**Current phase:** v1 — Core web app
**Increment in flight:** steps 1–2 done; step 3 (db client, migration, transaction
repository) underway — client + migration on disk, repository not yet written

---

## Where things stand

Git repo initialized, remote set to `git@github.com:matthewepler/money-trail.git`. Tooling
scaffolded: TypeScript strict (single root `tsconfig.json`), ESLint 9 flat config + Prettier,
Vitest, Playwright, `package.json` scripts per `CLAUDE.md`. `npm run lint && npm run
typecheck && npm test` all pass clean on the empty suite. `docker-compose.yml` runs local
Postgres 16; `.env.example` added.

Since then: `src/domain/transaction.ts` + tests and `src/domain/errors.ts` are committed
(`feat(domain): add normalized Transaction type with validation`), and `src/db/client.ts`,
`src/db/migrate.ts`, `0001-create-users-and-transactions.sql`, and `tests/helpers/db.ts`
exist uncommitted. The domain type already encodes ADR-0004's sign convention.

Still missing: repositories, parsers, services, the Fastify server, and the entire client.

**Decisions made this session:**
- Deploy target: local only for now, via Docker Compose (Postgres). No hosted deploy yet.
- v1 CSV format: **Chase** (`Details, Posting Date, Description, Amount, Type, Balance,
  Check or Slip #`; amount is already signed). Sample real export in `docs/sample_csv/`
  (gitignored — never commit real financial data). A synthetic fixture derived from this
  shape still needs to land in `fixtures/` before the parser is written.
- Schwab sample also provided (`docs/sample_csv/schwab.csv`, separate Withdrawal/Deposit
  columns, dollar-formatted strings) — deferred to v2 as the second format, already tracked
  in `BACKLOG.md`.
- No visual direction — plain system-font layout for v1.

**Note:** Docker itself is not installed on this machine (no `docker`, `podman`, or
`colima` found). `docker compose up` won't work until Docker Desktop (or an equivalent) is
installed — a system-level install to be done by the user, not automated here.

**Phase map (revised 2026-09-08):** v1 core web app → v2 resilience + auth + isolation →
v3 installable PWA → v4 live bank sync (Plaid) → v5 analysis and polish. The earlier
CLI/local-SQLite plan is superseded; see `DECISIONS.md` ADR-0003.

## Next step

Scaffold the v1 skeleton, in this order, one commit each:

1. Repo tooling: TypeScript strict, ESLint/Prettier, Vitest, Playwright, and the
   `package.json` scripts listed in `CLAUDE.md`. Confirm
   `npm run lint && npm run typecheck && npm test` runs clean on an empty suite.
2. `src/domain/transaction.ts` — normalized transaction type, money as integer cents.
   Browser-safe: no Node built-ins. Test first.
3. Postgres client + first migration + `src/repositories/transactionRepository.ts`
   (every method takes `userId` first, even in v1 with one seeded user).
4. `src/parsers/chaseCsv.ts` — one bank CSV format → domain transactions. Test first,
   against a fixture in `fixtures/`.
5. `src/services/categorizer.ts` — rule-based, from a static rules file. 100% covered.
6. `src/services/importer.ts` — wire parser → categorizer → repository.
7. Fastify bootstrap + session login for the seeded account + `POST /api/imports`,
   `GET /api/transactions`, `GET /api/summary`.
8. Vite/React client: login, transaction list, summary. Mobile-first at 375px.
9. Playwright e2e at mobile viewport covering the full happy path.

Do not start v2 (multi-user auth, dedupe, validation hardening, OFX) until the v1 gate is
met; nothing from v3 (manifest, service worker, offline) or v4 (Plaid) until v2's gate is
met — a repeated sync over overlapping date ranges is only safe once dedupe is correct.

## v1 gate criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | `npm test` passes, zero failures, zero skipped | ✅ passes (empty suite) |
| 2 | `npm run lint` and `npm run typecheck` clean | ✅ clean (empty suite) |
| 3 | Happy path works end to end in a real mobile browser | ❌ not started |
| 4 | No horizontal scroll or clipped controls at 375×667 | ❌ not started |
| 5 | Line coverage ≥ 60%; rule engine at 100% | ❌ not started — no code yet |
| 6 | No critical/high bugs open in `BACKLOG.md` | ✅ none open |
| 7 | `README.md` documents running the app locally in one command | ✅ written (untested — no Docker on this machine yet) |

## Open questions for a human

**v1 — needed now:**
- ~~Which bank CSV format is v1's single supported format?~~ Answered: Chase. A synthetic
  fixture built from `docs/sample_csv/chase.csv`'s shape still needs to land in `fixtures/`
  before step 4 (the parser) is written.
- ~~Where does this deploy?~~ Answered: local only for now, via Docker Compose. Revisit
  before v3/v4 if a real deploy target is needed.
- ~~Any visual direction for the UI?~~ Answered: none — plain system-font layout for v1.

**v2 — before auth work starts:**
- Session store: Postgres-backed or Redis? Postgres is one less service.
- Signup open to anyone, or invite-only for now?

**v3 — before PWA work starts:**
- Do we need an app icon set, or is a placeholder acceptable through v3?

**v4 — before Plaid work starts:**
- Plaid account and credentials: who holds `PLAID_CLIENT_ID`/`PLAID_SECRET`, and do we have
  production access or sandbox only?
- Plaid OAuth institutions redirect out to the bank and back to a registered `redirect_uri`.
  In an *installed* iOS PWA the return can land in Safari instead of the app — this needs
  testing on a real device early in v4, and may constrain which institutions we support.
- How is the at-rest encryption key for access tokens managed — KMS, or an env-supplied key?
- When a transaction arrives from both a CSV import and a sync, which source wins?

## Session log


Newest first. One or two lines per session.

- **2026-09-29** — Scaffolded repo tooling (step 1 of the v1 plan): git init + GitHub
  remote, TypeScript strict, ESLint 9 + Prettier, Vitest, Playwright, `package.json`
  scripts, `docker-compose.yml` for local Postgres, `.env.example`, `README.md`. Confirmed
  `npm run lint && npm run typecheck && npm test` clean on the empty suite. Answered the
  three open v1 questions: Chase CSV format, local Docker deploy, no visual direction.
  Docker is not installed on this machine yet — flagged, not installed automatically.
- **2026-09-29** — Scope narrowed to everyday spending across multiple checking accounts;
  credit cards, loans, and investments out (ADR-0004). Amount sign settled: negative =
  money out. Working through the pre-planning decision list, one at a time.
- **2026-09-08** — Retargeted the project from a local CLI to a web app + installable PWA.
  Rewrote `CLAUDE.md` (five phases, client/server layering, data-isolation rules, mobile and
  service-worker rules, Postgres over SQLite, Plaid secrets server-side only). Added
  ADR-0003; superseded ADR-0001. Bank sync moved v3 → v4.
- **2026-09-08** — Added read-only Plaid bank sync to the plan as a phase of its own, with
  Link owning credential entry (ADR-0002).
- **2026-09-08** — Wrote the first `CLAUDE.md` (phase strategy, gates, layering, workflow)
  and seeded `docs/STATUS.md` and `docs/BACKLOG.md`. No code yet.
