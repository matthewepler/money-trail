# money-trail

A web application and installable PWA for tracking everyday spending across **multiple
checking accounts**. It pulls transactions from those accounts (read-only, via Plaid) and
from file exports (CSV/OFX), normalizes them into a single ledger, categorizes them, and
reports on where money actually goes. Mobile-first: most sessions happen on a phone.

Credit cards, loans, and investment accounts are deliberately out of scope — see
`docs/DECISIONS.md` ADR-0004.

---

## Development Strategy

### Build a working v1 first

The default failure mode on this project is building the sophisticated version of a feature
before the simple version runs end to end. **Do not do that.** Ship a narrow slice that
works in a browser on a phone, then layer capability onto it in phases.

Rules that apply in every phase:

- A phase is not "in progress" until the previous phase's gate criteria are met.
- Do not build for a phase you are not in. If a v4 concern comes up while working in v1,
  write it to `docs/BACKLOG.md` and keep going.
- **Ask before expanding scope inside a phase.** If a task turns out to require work that
  wasn't in the request — a new dependency, a new route, a state-management library, a
  schema migration, an abstraction "for later" — stop and ask. Present the smallest option
  first.
- Every phase ends with something a user can actually open on their phone. No phase exists
  purely to build infrastructure.
- Prefer boring, deletable code. Early code should be easy to throw away.

### Phase v1 — Core web app

Goal: upload a CSV in a mobile browser, see categorized spending. One user, one flow, end
to end.

Scope:
- Fastify API + React/Vite client, sharing types from `src/domain/`
- Session login for a single seeded account (real cookie session, real password hash —
  signup and reset simply don't exist yet)
- CSV upload for one bank format
- Transaction normalization (date, amount, description, account)
- Rule-based categorization from a static rules file
- Postgres persistence
- Two screens: transaction list, and spend-by-category summary for a date range. The summary
  is spending only — `INCOME`, `LOAN_PAYMENTS`, and transfers are out of the total, and
  outbound transfers show on a separate "Transfers out (not matched)" line (ADR-0011)
- Responsive and usable at 375px wide

Explicitly out of scope in v1: **service worker, manifest, offline anything, any Plaid
call**, multi-user signup, OFX, multi-format detection, dedupe across imports, background
jobs, budgets, forecasting.

**Gate to v2 — all must be true:**
- [ ] `npm test` passes with zero failures and zero skipped tests
- [ ] `npm run lint` and `npm run typecheck` pass clean
- [ ] Happy path works end to end in a real mobile browser from a `fixtures/` sample
- [ ] No horizontal scroll and no clipped controls at 375×667
- [ ] Line coverage ≥ 60%, and 100% of the categorization rule engine
- [ ] No known critical or high bugs open in `docs/BACKLOG.md`
- [ ] `README.md` documents how to run the app locally in one command

### Phase v2 — Resilience, auth, and multi-user isolation

Goal: the v1 path survives messy input and real users without leaking data across accounts.
This phase is also the hard prerequisite for v4: a bank sync runs repeatedly over
overlapping date ranges, so idempotent writes and dedupe must be correct *before* any
network-sourced data exists.

Scope:
- Real multi-user auth: signup, argon2id hashing, session rotation, logout everywhere.
  **No password reset and no email verification** — the app sends no mail at all
  (ADR-0009). A forgotten password is reset by hand against the database.
- **Every repository query scoped by `userId`** — see Data Isolation below
- CSRF protection, security headers, rate limiting on auth and upload routes
- Input validation with actionable error messages (bad dates, bad amounts, wrong columns)
- Idempotent imports — layered identity, never a bare content hash (see Transaction
  Identity below)
- Transactional writes; a failed import rolls back cleanly
- Structured logging and a real error taxonomy (see Error Handling)
- Second bank format + format auto-detection
- Transfer matching across accounts and a cash-flow view (ADR-0011): a transfer out with a
  matching deposit in another account is neutral; one with no match counts as spending
- Schema migrations
- Account deletion (`DELETE /api/account`, behind password re-entry) and full-ledger export
  (`GET /api/export`, JSON) — see ADR-0010

**Gate to v3 — all must be true:**
- [ ] Everything in the v1 gate still true
- [ ] Line coverage ≥ 80%; every error branch in the import pipeline has a test
- [ ] A test proves user A cannot read, modify, or delete any row belonging to user B,
      including by passing B's ids directly to every route
- [ ] Malformed-input fixtures exist and are tested for all supported formats
- [ ] Importing the same file twice produces zero duplicate rows (regression test)
- [ ] Two genuinely identical transactions on the same day and account both survive import
      (regression test — the case a naive content hash silently eats)
- [ ] A transfer out matched by a deposit in another imported account is excluded from
      spending; an unmatched one is counted (a test for each)
- [ ] Migrations run forward on a v1-era database in a test
- [ ] Deleting an account leaves no rows behind in any table (test asserts counts, not just
      a successful response)

### Phase v3 — Installable PWA

Goal: the app installs to a home screen, launches offline, and feels native on a phone.

Scope:
- `manifest.webmanifest`, icon set, maskable icons, theme color, `display: standalone`
- Service worker via `vite-plugin-pwa` (Workbox): precached app shell, network-first for
  data reads, never any cached mutation
- Offline state: cached ledger renders read-only behind a clear offline banner; actions
  that need the network are disabled with an explanation, not a silent failure
- An explicit update prompt when a new service worker is waiting — never a silent swap
  mid-session
- Mobile polish: safe-area insets, `dvh` units, ≥44px touch targets, no hover-only
  affordances
- Playwright e2e at mobile viewport, including an offline run

**Gate to v4 — all must be true:**
- [ ] Everything in the v2 gate still true
- [ ] Lighthouse on mobile throttling: installable, PWA checks pass, performance ≥ 90
- [ ] The app cold-launches offline from the home screen and shows cached data
- [ ] Logging out clears every cache and client-stored ledger row (asserted by e2e)
- [ ] Shipping a new build shows the update prompt; accepting it loads the new version
- [ ] Verified on a real iOS device and a real Android device, not just emulation

### Phase v4 — Live bank sync (read-only, via Plaid)

Goal: transactions arrive from the user's banks, through the same normalize → categorize →
store pipeline v1 built and v2 hardened.

Scope:
- Plaid Link in the browser; `link_token` minted server-side, `public_token` exchanged
  server-side
- Item / access-token storage, encrypted at rest, one record per connected institution
- `/transactions/sync` with a persisted cursor per item — incremental, resumable
- Mapping Plaid transactions onto the existing domain transaction (no parallel model)
- Handling `removed` and modified transactions from the sync response
- Pending transactions reconciled via `pending_transaction_id`, never by content
- Re-auth detection (`ITEM_LOGIN_REQUIRED`) surfaced as an actionable in-app prompt, which
  mints an update-mode `link_token`
- Disconnect a bank: call `/item/remove`, then delete the local item record — in that order
- Rate-limit and transient-failure retry with backoff, confined to the provider layer

**Read-only with respect to money.** The full allowlist: `/link/token/create` (initial link
*and* update mode for re-auth), `/item/public_token/exchange`, `/accounts/get`,
`/transactions/sync`, `/institutions/*`, and `/item/remove` (disconnect — a write, but one
that only revokes our own access). Never a payment, transfer, or funds-movement endpoint.
Adding anything to this list requires an ADR. See Bank Connectivity below.

**Gate to v5 — all must be true:**
- [ ] Everything in the v3 gate still true
- [ ] Coverage ≥ 80% overall, ≥ 90% on `src/services/`; the Plaid mapper at 100%
- [ ] The suite runs fully offline and fails loudly if code attempts a real HTTP call
- [ ] Syncing twice over an overlapping cursor produces zero duplicate rows (regression test)
- [ ] Recorded sandbox fixtures cover: first sync, incremental sync, removed transaction,
      expired item, rate limit
- [ ] No access token, public token, or full account number appears in any log, error
      message, or API response (asserted by test)
- [ ] The Link flow completes in the *installed* PWA on iOS, including an OAuth institution

> Nothing in v4 depends on v3. If bank sync matters more than installability, say so and
> we swap the two — but do not start either while the v2 gate is open.

### Phase v5 — Analysis and polish

Budgets and variance reporting, recurring/subscription detection, heuristic categorization layered on the rule engine (explicit rules always win),
CSV/JSON export, push notifications for large transactions, performance work on large
ledgers, background sync jobs. Each feature behind a flag that degrades to v4 behavior when
off; full-ledger benchmark (`npm run bench`) under 2s for 50k transactions. Do not start any
of this before the v4 gate.

---

## Development Rules

### Test-driven by default

1. Write the failing test first. Run it. Confirm it fails for the expected reason.
2. Write the smallest implementation that passes.
3. Refactor with the test green.

Unit tests live next to the code as `*.test.ts` / `*.test.tsx`. API and database integration
tests go in `tests/integration/`. Browser e2e goes in `tests/e2e/` and runs at mobile
viewport by default. Never delete or `.skip` a failing test to make the suite green — fix it
or report it.

Component tests assert behavior through the accessible tree (roles, labels, text), not
implementation details or class names.

### Coverage expectations per phase

| Phase | Overall lines | Required at 100% |
|-------|---------------|------------------|
| v1    | ≥ 60%         | rule engine (`src/services/categorizer.ts`) |
| v2    | ≥ 80%         | import pipeline error branches; per-user scoping in repositories |
| v3    | ≥ 80%         | above, plus an offline e2e path |
| v4    | ≥ 80% (90% in `src/services/`) | above, plus the Plaid mapper |

Coverage is a floor, not a goal. Do not write assertion-free tests to raise a number.

### Layering

Dependencies point one direction only:

```
web → api client → HTTP → server routes → services → { repositories → db, providers }
```

- **`web/`** — React client. Presentation and client state only. No business logic, no money
  math beyond formatting, no direct `fetch` outside `web/api/`.
- **`web/api/`** — typed fetch wrappers. The only place `fetch` is called.
- **`server/routes/`** — HTTP concerns only: parse, validate, authenticate, call one service,
  format the response. No SQL, no business logic.
- **`services/`** — all business logic. Dependency-injected; services receive repositories
  and providers, never import the db client or an SDK directly.
- **`repositories/`** — the only place SQL lives. One repository per aggregate. Every method
  takes `userId` as its first argument — except the pre-auth lookups in `userRepository` and
  `sessionRepository`, which run before a session exists to supply one (ADR-0012).
- **`providers/`** — the only place outbound network I/O lives (v4+). Services depend on a
  narrow interface, never on the Plaid SDK.
- **`domain/`** — types, value objects, errors. Shared by client and server. No I/O, no
  framework imports, no Node built-ins (it must bundle for the browser).

A layer never imports upward. If you need to, the abstraction is wrong — ask.

### Transaction identity (v2+)

Dedupe is layered. **Never identify a transaction by a bare content hash** — two identical
$3.50 coffees on the same day are two transactions, and silently merging them is data loss.

1. **File level.** Hash the uploaded file; re-importing the identical file is a no-op.
2. **Row level, imported (CSV/OFX).** Identity is
   `(source, account, date, amountCents, description, occurrenceIndex)`, where
   `occurrenceIndex` counts identical rows within that date and account. Two coffees stay
   two coffees.
3. **Row level, provider (v4+).** Identity is `(source, externalId)` — Plaid's
   `transaction_id`. Pending rows reconcile to their posted row via `pending_transaction_id`,
   never by comparing content: a posted amount often differs from the pending one (tips,
   fuel holds).

Posted-only through v3; CSV exports carry no pending rows. The `source`, `externalId`, and
`occurrenceIndex` columns exist from the start so v4 needs no backfill.

### Data isolation (v2+)

- Every repository method takes `userId` as its first parameter and includes it in the
  `WHERE` clause. There is no repository method that reads a transaction by id alone.
- The `userId` comes from the session, **never** from a request body, query string, or path
  parameter. A client-supplied user id is an attack, not an input.
- Every new route gets a test that another user's session cannot reach its data.
- Never return an internal id or row that the session's user doesn't own — 404, not 403, so
  the response doesn't confirm the row exists.

### Error handling

- Throw typed errors from `src/domain/errors.ts` (`ValidationError`, `ImportError`,
  `NotFoundError`, `AuthError`, `ConfigError`, and v4+ `ProviderError`,
  `ReauthRequiredError`, `RateLimitError`). Never throw bare strings.
- Errors carry a stable `code` and enough context to act on ("row 42: amount '12,3x' is not
  a number"), never just "invalid input".
- One error handler at the server boundary maps typed errors to status codes and safe
  response bodies. Internal messages and stack traces never reach the client.
- The client renders errors by `code`, not by matching message text.
- Catch only where you can add context or recover. Do not swallow; do not log-and-rethrow
  at every level.
- Never put a credential, token, session id, or full account number in an error message,
  log line, or API response. Provider errors carry the Plaid `error_code` and `request_id` —
  never the payload.
- Money is integer cents (`number`) internally, formatted only at the view edge. Never use
  floats for amounts. Never let a raw string amount past the parser.

### Mobile and PWA rules

- **Mobile-first.** Write the 375px layout first, then add breakpoints upward. Test at
  375×667, 768, and 1280 before calling a screen done.
- Use `dvh`/`svh`, not `vh` — iOS URL-bar collapse breaks `100vh`. Respect
  `env(safe-area-inset-*)` and set `viewport-fit=cover`.
- Touch targets ≥ 44×44px. No interaction that only exists on hover or right-click.
- Inputs use the right `inputmode` and `type` so mobile keyboards are correct; amount fields
  use `inputmode="decimal"`.
- Long lists (a year of transactions is thousands of rows) must virtualize or paginate —
  never render the whole ledger into the DOM.
- Service worker rules (v3+): precache the app shell; network-first for data reads with a
  short expiry; **never cache mutations, auth responses, or anything from Plaid**. Purge
  every cache on logout. Ship an update prompt rather than `skipWaiting`.
- The client cache is never the source of truth. Assume it can be evicted, and assume an
  installed iOS app's storage is separate from the browser's.
- No offline write queue before v5. Offline means read-only, said plainly in the UI.

### Bank connectivity and secrets (v4+)

- **The app never sees bank credentials.** Plaid Link collects them in Plaid's own UI and
  returns a public token. Do not build a bank username/password field, do not accept
  credentials as parameters, do not store or forward them. If a task appears to require
  handling a bank password directly, stop and ask — the answer is Link.
- **Read-only with respect to money**, which is the promise being made — not "no HTTP verb
  that writes". `/item/remove` is the one write we make, and it only revokes our own access.
  Any payment, transfer, or funds-movement endpoint is out of scope for this project
  entirely: no exception, no feature flag, no "just for testing".
- **Never orphan a token.** Disconnecting a bank calls `/item/remove` before deleting the
  local record, and deleting an account removes every item first. Deleting our copy while
  Plaid's connection stays live is a bug, not a shortcut — it keeps reading the user's bank.
- `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` are **server-side only**. Nothing under
  `src/web/` may reference them, and no secret may reach a `VITE_`-prefixed variable — Vite
  inlines those into the public bundle.
- Access tokens are stored server-side, encrypted at rest. They are never sent to the
  client, never logged, never printed. The client only ever holds a `link_token`.
- All outbound network I/O lives in `src/providers/plaid/`. Nothing else imports the Plaid
  SDK or an HTTP client.
- The CSP allows exactly one third-party script origin, `https://cdn.plaid.com`, for Link.
  Adding any other external origin is a scope expansion — ask.
- **Tests never touch the network.** The suite runs offline against recorded sandbox
  fixtures in `fixtures/plaid/`; an attempted real HTTP call is a failing test. Develop
  against `PLAID_ENV=sandbox`.

### Code style

- TypeScript strict mode across client and server. No `any` — use `unknown` and narrow it.
- Named exports only; no default exports (React components included).
- `async/await` over promise chains.
- Function components with hooks. No class components. Keep components under ~150 lines;
  extract a hook before reaching for a state-management library — adding one is a scope
  expansion, so ask.
- Comments explain *why*, not *what*. No commented-out code.
- Formatting and lint are settled by Prettier + ESLint. Do not hand-format; run the tools.

### Refactor vs. add

Refactor when: a test is hard to write because of the shape of the code; the same logic
exists in three places; a change to one layer forces edits in another.

Add features when: the gate criteria for the current phase are met and the feature is in
the current phase's scope.

Do not refactor and add a feature in the same change. Land the refactor with tests green,
then build on it. Do not "clean up while you're in there" — mention it, don't do it.

---

## Workflow

### Commands

```bash
npm install              # install dependencies
npm run dev              # api + client with hot reload (client on :5173, api on :3000)
npm run dev:api          # server only
npm run dev:web          # client only
npm run build            # typecheck + build client and server
npm run preview          # serve the production build (use this to test the service worker)
npm test                 # unit + integration suite (vitest)
npm run test:watch       # watch mode, use during TDD
npm run test:cov         # coverage report
npm run test:e2e         # playwright, mobile viewport by default
npm run lint             # eslint
npm run lint:fix         # eslint --fix
npm run typecheck        # tsc --noEmit
npm run db:migrate       # apply pending migrations
npm run db:reset         # drop, recreate, migrate, seed the dev database
npm run seed             # seed the dev account and sample transactions
npm run lighthouse       # PWA + performance audit against the preview build (v3+)
npm run bench            # performance benchmark (v5)
npm run plaid:record     # refresh recorded sandbox fixtures (v4+, hits Plaid sandbox only)
```

The service worker only runs against a production build — debug PWA behavior with
`npm run build && npm run preview`, never `npm run dev`.

To test on a real phone on the same network:

```bash
npm run dev -- --host      # then open http://<your-lan-ip>:5173 on the device
```

### Before considering any task done

```bash
npm run lint && npm run typecheck && npm test
```

All three clean. Touching anything under `src/web/` or the service worker also means
`npm run test:e2e`. If any fail, the task is not done — report the failure output rather
than working around it.

### CI

GitHub Actions runs the full gate on every push and pull request: `lint`, `typecheck`,
unit + integration against a `postgres:16` service container, then Playwright e2e at mobile
viewport. Cache npm and the Playwright browser download; e2e is the slow job, so it runs in
parallel with the others, not after them.

CI is the authority on whether a gate criterion passes. If CI is red, the task is not done —
do not merge on the strength of a clean local run, and do not disable a job to get green.

### Common Tasks

**Ask for one increment at a time, scoped to the current phase.** Good requests name the
change, the layer, and the test.

*Example 1 — a full-stack field, v1 scope:*

> Add a `merchant` field to the normalized transaction. Update `domain/transaction.ts`, the
> CSV parser, the migration, and the transaction list row. Write the parser test first.
> Don't touch categorization yet — that's a separate step.

*Example 2 — a v2 increment with isolation:*

> We're in v2. Add `DELETE /api/transactions/:id`. Repository method takes `userId` first
> and scopes the delete; the route reads `userId` from the session only. Write two failing
> integration tests first: the owner deletes successfully, and another user's session gets a
> 404 for the same id. No UI yet.

*Example 3 — a v3 PWA increment:*

> We're in v3. Make the summary screen render from cache when offline: network-first with a
> 5-minute expiry, plus an offline banner. Add a Playwright test that loads the screen
> online, goes offline, reloads, and asserts the cached figures and the banner. Don't cache
> anything from the auth or upload routes.

*Example 4 — checking a phase gate:*

> Run the v1 gate checklist from CLAUDE.md against the current state. Report each criterion
> as pass/fail with evidence, and list what's left. Don't start v2 work.

Anti-patterns to reject: "build the whole import system", "make it production-ready", "add
caching, retries, and a plugin API", "just wire up Plaid real quick" or "throw a service
worker on it" while an earlier gate is open — these skip phases. Ask which single increment
is wanted.

### Resuming across sessions

State lives in the repo, not in conversation history.

1. Read `docs/STATUS.md` first — current phase, the increment in flight, next intended step.
2. Read `docs/BACKLOG.md` for deferred items and known bugs (tagged `v1`…`v5`).
3. Read `docs/DECISIONS.md` before proposing an architectural change — it may already be
   settled, or already rejected.
4. Run `git log --oneline -15` and `git status` to see what actually landed.
5. Run `npm test` before writing anything, so you know the baseline.

At the end of a session — or when a meaningful increment lands — update `docs/STATUS.md`:
current phase, what changed, gate criteria status, next step, and any open question that
needs a human answer. Keep it under a page.

---

## Project Context

### Structure

```
money-trail/
├── src/
│   ├── web/                 # React + Vite client (the PWA)
│   │   ├── main.tsx
│   │   ├── routes/          # one folder per screen — Summary/, Transactions/, Link/
│   │   ├── components/      # shared presentational components
│   │   ├── hooks/           # useTransactions.ts, useOnlineStatus.ts
│   │   ├── api/             # typed fetch wrappers — the ONLY place fetch() is called
│   │   └── styles/
│   ├── server/
│   │   ├── index.ts         # Fastify bootstrap
│   │   ├── routes/          # HTTP only — validate, authenticate, call a service
│   │   └── middleware/      # session, csrf, security headers, rate limiting
│   ├── services/            # business logic — importer, normalizer, categorizer, reporter
│   ├── repositories/        # SQL only; every method takes userId first
│   ├── parsers/             # per-format readers — chaseCsv.ts, ofx.ts (v2)
│   ├── providers/           # outbound network I/O only (v4+)
│   │   └── plaid/           # client.ts, mapper.ts, sync.ts — sole importer of the SDK
│   ├── domain/              # types, value objects, errors — shared, browser-safe
│   └── db/
│       ├── client.ts
│       └── migrations/      # NNNN-description.sql, applied in order
├── public/                  # manifest.webmanifest, icons (v3+)
├── tests/
│   ├── integration/         # API + database
│   ├── e2e/                 # playwright, mobile viewport
│   └── helpers/
├── fixtures/                # sample exports, including deliberately malformed ones
│   └── plaid/               # recorded sandbox responses — tests never hit the network
├── docs/
│   ├── STATUS.md            # current phase + in-flight work (read this first)
│   ├── BACKLOG.md           # deferred items and bugs, tagged by phase
│   └── DECISIONS.md         # short ADRs, one per non-obvious choice
└── CLAUDE.md
```

### Conventions

- Modules: `camelCase.ts`. React components: `PascalCase.tsx`, one component per file.
  Hooks: `useThing.ts`. Types and classes: `PascalCase`. Constants: `SCREAMING_SNAKE`.
- One primary export per file; the filename matches it (`categorizer.ts` → `categorize`).
- Tests: `foo.test.ts` beside `foo.ts`. Integration: `tests/integration/*.test.ts`.
  E2E: `tests/e2e/*.spec.ts`.
- API routes are plural nouns under `/api/` — `/api/transactions`, `/api/summary`.
  Responses are `{ data }` or `{ error: { code, message } }`, never a bare array.
- Migrations: `0003-add-merchant-column.sql` — sequential, never edited once applied.
- Categories are **Plaid Personal Finance Category primaries** — `SCREAMING_SNAKE` strings
  like `FOOD_AND_DRINK`, stored as-is (ADR-0005). `NULL` means uncategorized; there is no
  `OTHER` bucket. Human-readable labels live only in `src/web/` — never in the database,
  never in a rule file.
- Money: integer cents everywhere, signed (negative = money out), formatted only in the
  view. Dates: ISO `YYYY-MM-DD` strings at every boundary, `Date` objects only inside
  services.
- Commits: `type(scope): summary` — e.g. `feat(importer): dedupe rows by content hash`.
  One increment per commit.

### Stack decisions and constraints

- **TypeScript on Node 20+**, ESM, strict mode, client and server.
- **React 18 + Vite** for the client; **React Router**; **vite-plugin-pwa** (Workbox) for
  manifest and service worker in v3. CSS modules — no CSS-in-JS runtime.
- **Fastify** for the API. Sessions in httpOnly, Secure, SameSite=Lax cookies. No JWT in
  `localStorage` — ever.
- **Postgres** via `pg`, plain SQL, no ORM. Repositories write SQL directly.
- **Checking accounts only** (ADR-0004). No credit cards, loans, or investments. Parsers
  reject non-checking exports; in v4, Plaid Link is configured for `depository`/`checking`
  only and the mapper drops anything else. A request to "also track my credit card" is a
  scope expansion — ask before building it.
- **Amount sign: negative = money out, positive = money in**, on every account. Parsers
  normalize to this; the v4 Plaid mapper negates, since Plaid reports depository outflows
  as positive. Never store an unsigned amount.
- **Vitest** + Testing Library for unit/integration, **Playwright** for e2e,
  **ESLint + Prettier** for style.
- **Plaid** (`plaid` Node SDK) is the only bank connectivity, added in v4, read-only,
  server-side only, confined to `src/providers/plaid/`. Credentials are handled by Plaid
  Link, never by us.
- **The app sends no email** (ADR-0009). No verification, no reset links, no notifications.
  This is what keeps "one outbound destination" true; revisit it when the app has users
  other than its author, and write an ADR before adding a mail vendor.
- **Financial data is private.** The server is the only place the ledger lives in full;
  the client holds only what it is currently showing. Plaid is the single permitted
  outbound destination. No telemetry, no analytics, no crash reporting, no third-party
  script other than Plaid Link; reject any dependency that phones home.
- There is no user-facing CLI. `db:migrate`, `db:reset`, `seed`, and `plaid:record` are
  developer scripts only.
- Supported targets: iOS Safari 16.4+, Chrome/Android 110+, evergreen desktop. Progressive
  enhancement is expected — the app must work in a plain mobile browser tab before it works
  as an installed PWA.
