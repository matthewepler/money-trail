# STATUS

> Read this first when resuming. Update it when an increment lands or a session ends.
> Keep it under a page — details belong in `BACKLOG.md` or `DECISIONS.md`.

**Last updated:** 2026-10-03 (step 4, the Chase CSV parser, landed)
**Current phase:** v1 — Core web app
**Increment in flight:** steps 1–4 done, plus the ADR-0006 identity follow-up; step 5
(`src/services/categorizer.ts`, TDD, 100% covered) next. Verify ADR-0005's Plaid PFC
primary list against Plaid's published taxonomy first (see `BACKLOG.md`).

---

## Where things stand

Git repo initialized, remote set to `git@github.com:matthewepler/money-trail.git`. Tooling
scaffolded: TypeScript strict (single root `tsconfig.json`), ESLint 9 flat config + Prettier,
Vitest, Playwright, `package.json` scripts per `CLAUDE.md`. `npm run lint && npm run
typecheck && npm test` all pass clean on the empty suite. `docker-compose.yml` runs local
Postgres 16; `.env.example` added.

Since then: `src/domain/transaction.ts` + tests and `src/domain/errors.ts` (now also
`ConfigError`) are committed. Docker Desktop is installed and running; `docker compose up -d`
brings up Postgres 16 (confirmed healthy). Migration `0001-create-users-and-transactions.sql`
is written and applies cleanly (`users`, `transactions` with a `user_id` FK and a
`(user_id, date)` index) via a small custom runner (`src/db/migrate.ts` — no migration
framework dependency). `src/repositories/transactionRepository.ts` is built test-first
against a real local Postgres: `insertTransactions`, `listTransactions` (date-range filter,
newest-first), `summarizeByCategory`, every method scoped by `userId` first. Integration
tests in `tests/integration/transactionRepository.test.ts` include a cross-user isolation
check (user A never sees user B's rows) — 13/13 tests pass, lint/typecheck clean.

Local env: `.env` (gitignored) mirrors `.env.example`; Node scripts load it via Node's native
`--env-file` flag (no `dotenv` dependency); Vitest loads it into `process.env` via Vite's
`loadEnv` in `vitest.config.ts` so integration tests can reach the DB.

**ADR-0006 follow-up landed:** migration `0002-add-transaction-identity.sql` adds `source`
(not null), `external_id` (nullable, unique per source), and `occurrence_index` (not null),
plus a unique index on `(user_id, source, account, date, amount_cents, description,
occurrence_index)` as a safety net. `StoredTransaction` and `transactionRepository.ts` carry
the new fields; `insertTransactions` now computes `occurrence_index` itself in a single
query — against rows already persisted for the user *and* duplicates within the same
batch — via `ROW_NUMBER()` over the batch joined against a per-identity count of existing
rows. Callers no longer supply it. 18/18 tests pass, including: sequential indices within
one batch, indices continuing correctly across two separate imports, scoping per user, and
no mixing across sources. Enforcement (skip-on-duplicate import) is still v2 scope — v1 only
needed the columns and correct indexing to exist from the start, so v4 needs no backfill.

**Step 4 landed:** `src/parsers/chaseCsv.ts` (`parseChaseCsv(text, { account })` →
`Transaction[]`, file order) on top of a small in-repo tokenizer, `src/parsers/csv.ts` — no
CSV dependency added. Handles the real export's quirks (8 data fields under a 7-column
header, descriptions padded with runs of spaces, which are collapsed). Amounts are parsed
from the string to integer cents without touching a float. Errors are `ImportError`
(new, `src/domain/errors.ts`) with a stable `code` — `IMPORT_UNSUPPORTED_FORMAT` (header
isn't a Chase checking export, which is how ADR-0004's "parsers reject non-checking
exports" is enforced), `IMPORT_INVALID_ROW` (message names the row, e.g. "row 3: date
'2026-09-28' is not in MM/DD/YYYY format"), `IMPORT_MALFORMED_FILE`. The synthetic fixture
is `fixtures/chase-checking.csv`; the real export stays in the gitignored `docs/sample_csv/`.
The parser does not set `source` or `category` — the importer (step 6) does. 45/45 tests
pass, 75.5% line coverage.

Still missing: categorizer, importer, the Fastify server, and the entire client.

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

**Note:** Docker Desktop is now installed and its daemon is running. The `docker` CLI isn't
on the default shell `PATH` on this machine — invoke it via
`/Applications/Docker.app/Contents/Resources/bin/docker`, or add that directory to `PATH`.

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
| 5 | Line coverage ≥ 60%; rule engine at 100% | ⏳ 75.5% overall now; categorizer not written yet |
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
- ~~Category taxonomy?~~ Answered: Plaid PFC primaries, stored verbatim (ADR-0005). The
  exact list still needs verifying against Plaid's published taxonomy before step 5.

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

## Decisions settled this session

- ADR-0004 — checking accounts only; amounts signed, negative = money out.
- ADR-0005 — categories are Plaid PFC primaries, stored verbatim (list needs verifying).
- ADR-0006 — layered transaction identity; never a bare content hash.
- ADR-0007 — GitHub Actions runs the full gate, e2e included, from now rather than v2.
- ADR-0008 — "read-only" means no funds movement; `/item/remove` and update-mode Link are
  allowed.
- ADR-0009 — the app sends no email; password reset is manual. Passkeys considered and
  deferred, not rejected.
- ADR-0010 — self-service account deletion and JSON export land in v2.

**No decisions outstanding.** The pre-planning pass is complete; remaining items are work,
not questions. Migration `0002` (ADR-0006 identity columns) and the repository update are
done; step 4's parser is next and unblocked.

## Session log


Newest first. One or two lines per session.

- **2026-10-03** — Step 4: `parseChaseCsv` + an in-repo CSV tokenizer + `ImportError`,
  test-first against a synthetic fixture shaped like the real export. 45/45 tests pass.
  Step 5 (categorizer) is next.
- **2026-09-29** — Migration `0002-add-transaction-identity.sql` (`source`, `external_id`,
  `occurrence_index`, plus a unique identity index) and `transactionRepository.ts` updated to
  compute `occurrence_index` server-side, against both persisted rows and same-batch
  duplicates — the ADR-0006 follow-up required before step 4. 18/18 tests pass. Step 4
  (`src/parsers/chaseCsv.ts`) is next and unblocked.
- **2026-09-29** — Decision pass before planning: scope narrowed to checking accounts only
  and amount sign settled (ADR-0004); category taxonomy set to Plaid PFC primaries
  (ADR-0005). STATUS synced with what is actually on disk.
- **2026-09-29** — Scaffolded repo tooling (step 1 of the v1 plan): git init + GitHub
  remote, TypeScript strict, ESLint 9 + Prettier, Vitest, Playwright, `package.json`
  scripts, `docker-compose.yml` for local Postgres, `.env.example`, `README.md`. Confirmed
  `npm run lint && npm run typecheck && npm test` clean on the empty suite. Answered the
  three open v1 questions: Chase CSV format, local Docker deploy, no visual direction.
  Docker is not installed on this machine yet — flagged, not installed automatically.
- **2026-09-29** — Scope narrowed to everyday spending across multiple checking accounts;
  credit cards, loans, and investments out (ADR-0004). Amount sign settled: negative =
  money out. Working through the pre-planning decision list, one at a time.
- **2026-09-29** — Docker Desktop installed; local Postgres up via `docker compose`. Step 3
  landed: `src/db/client.ts`, migration runner + first migration (`users`, `transactions`),
  and `src/repositories/transactionRepository.ts` (insert, list with date-range filtering,
  category summary), all scoped by `userId`, TDD against a real local database. 13/13 tests
  pass, including a cross-user isolation check.
- **2026-09-08** — Retargeted the project from a local CLI to a web app + installable PWA.
  Rewrote `CLAUDE.md` (five phases, client/server layering, data-isolation rules, mobile and
  service-worker rules, Postgres over SQLite, Plaid secrets server-side only). Added
  ADR-0003; superseded ADR-0001. Bank sync moved v3 → v4.
- **2026-09-08** — Added read-only Plaid bank sync to the plan as a phase of its own, with
  Link owning credential entry (ADR-0002).
- **2026-09-08** — Wrote the first `CLAUDE.md` (phase strategy, gates, layering, workflow)
  and seeded `docs/STATUS.md` and `docs/BACKLOG.md`. No code yet.
