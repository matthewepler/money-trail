# STATUS

> Read this first when resuming. Update it when an increment lands or a session ends.
> Keep it under a page — details belong in `BACKLOG.md` or `DECISIONS.md`.

**Last updated:** 2026-10-11 (step 8, the client, landed)
**Current phase:** v1 — Core web app
**Increment in flight:** steps 1–8 done; step 9 (Playwright e2e at mobile viewport) and the CI
workflow (ADR-0007) remain before the v1 gate can be called.

---

## Where things stand

The v1 slice works end to end: sign in, import a Chase checking CSV, see the ledger, see
spending by category. 272 tests pass (0 skipped), 90.89% line coverage, `categorizer.ts` at
100% (enforced by `npm run test:cov`), lint/typecheck clean, `npm audit` 0 vulnerabilities.

**As built.** Postgres 16 in Docker Compose; Fastify 5 API on `127.0.0.1:3000`; React 18 +
Vite client (React Router 7, CSS modules) proxying `/api`. Migrations `0001` users and
transactions, `0002` transaction identity (ADR-0006), `0003` sessions. Pipeline:
`parseChaseCsv` → `categorize` (ordered regex rules, Plaid PFC categories) → `insertTransactions`,
all-or-nothing per file. API: `POST/GET/DELETE /api/session`, then behind the session guard
`POST /api/imports`, `GET /api/transactions` (paged), `GET /api/summary` (spending only,
ADR-0011). Client: sign-in, Transactions (paged list + CSV import), Summary (date range,
total, per-category bars, "Transfers out (not matched)" line). Layering is lint-enforced: the
client imports only `src/domain/`, and `fetch` lives only in `src/web/api/`.

**Running it.** `docker compose up -d` (Docker Desktop must be open; its CLI is not on `PATH`
here — use `/Applications/Docker.app/Contents/Resources/bin/docker`), `cp .env.example .env`,
set `SEED_PASSWORD`, `npm run db:migrate`, `npm run seed`, `npm run dev`. `npm test` uses its
own `money_trail_test` database (created automatically) and never touches dev data.

**Not built yet:** Playwright e2e, the GitHub Actions workflow, `npm run db:reset`
(the script exists but its file doesn't — see `BACKLOG.md`).

**Phase map (revised 2026-09-08):** v1 core web app → v2 resilience + auth + isolation →
v3 installable PWA → v4 live bank sync (Plaid) → v5 analysis and polish. See ADR-0003.

## Next step

9. Playwright e2e at mobile viewport covering the happy path (sign in → import the fixture →
   list → summary → sign out), against the `_test` database and a seeded user.
10. GitHub Actions: lint + typecheck + unit/integration on a `postgres:16` service, e2e as a
    parallel job (ADR-0007).
11. Close the gate: try the app on a real phone (`npm run dev -- --host`, then
    `http://<lan-ip>:5173`) and settle the README question below.

Do not start v2 until the v1 gate is met; nothing from v3 or v4 until v2's gate is met — a
repeated sync over overlapping date ranges is only safe once dedupe is correct.

## v1 gate criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | `npm test` passes, zero failures, zero skipped | ✅ 272 pass, none skipped |
| 2 | `npm run lint` and `npm run typecheck` clean | ✅ clean |
| 3 | Happy path works end to end in a real mobile browser | ⏳ done by hand in the in-app browser (emulated 375×812) on the live stack; not automated yet (step 9) and not on a physical phone |
| 4 | No horizontal scroll or clipped controls at 375×667 | ✅ measured on all three screens at 375×667, 768 and 1280: no overflow, every target ≥44px, tab bar never covers content; to be asserted in e2e |
| 5 | Line coverage ≥ 60%; rule engine at 100% | ✅ 90.89%; `categorizer.ts` 100%, enforced by thresholds |
| 6 | No critical/high bugs open in `BACKLOG.md` | ✅ none open |
| 7 | `README.md` documents running the app locally in one command | ⏳ documented as a short setup then `npm run dev` — see question below |

## Open questions for a human

**v1 — before closing the gate:**
- Gate item 7 says "one command". The README documents six first-time setup commands, then
  `npm run dev`. Is that enough, or should there be a single `npm run setup` that starts
  Postgres, migrates, and seeds?

**v2 — before auth work starts:**
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

## Decisions settled

- ADR-0004 — checking accounts only; amounts signed, negative = money out.
- ADR-0005 — categories are Plaid PFC primaries, stored verbatim (list verified 2026-10-03).
- ADR-0006 — layered transaction identity; never a bare content hash.
- ADR-0007 — GitHub Actions runs the full gate, e2e included, from now rather than v2.
- ADR-0008 — "read-only" means no funds movement; `/item/remove` and update-mode Link allowed.
- ADR-0009 — the app sends no email; password reset is manual.
- ADR-0010 — self-service account deletion and JSON export land in v2.
- ADR-0011 — the primary view is spending; income and loan payments are a separate cash-flow
  view; an outbound transfer with no matching deposit is spending. v1 shows unmatched
  transfers on their own line; matching lands in v2; card spending stays out of scope.
- ADR-0012 — Postgres sessions (token hash only), `text/csv` uploads, loopback-only API,
  tests on a `_test` database.
- v1 CSV format is Chase (Schwab is the v2 second format); deploy is local Docker only;
  no visual direction (plain system-font layout).

## Session log

Newest first.

- **2026-10-11** — Step 8: the client in small commits — Vite/React scaffold, typed API
  client, session state + sign-in + shell, formatting (one place flips the sign), Transactions
  (paged, with CSV import), Summary. Verified in the browser at 375/768/1280 against the live
  server, plus a contrast audit (all AA, light and dark). Found and fixed a broken
  `npm run dev:api`, a misleading parser date message, and cleared `npm audit`. Step 9 next.
- **2026-10-11** — Steps 6–7: the importer and the Fastify server (login, sessions, imports,
  transactions, summary). Tests were wiping the dev database; moved them to `_test`.
  ADR-0011 (spending view) and ADR-0012 (server choices) recorded.
- **2026-10-03** — Steps 4–5: Chase CSV parser and the categorizer; verified the Plaid PFC
  list (new Plaid accounts default to PFCv2 — a v4 decision, in the backlog).
- **2026-09-29** — Repo tooling, domain type, Postgres + repository, transaction identity
  (ADR-0006), and the scope decisions (ADR-0004, 0005).
- **2026-09-08** — Retargeted from a CLI to a web app + PWA (ADR-0003); wrote `CLAUDE.md` and
  the first docs; added read-only Plaid sync as its own phase (ADR-0002).
