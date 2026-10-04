# DECISIONS

Short ADRs — one per non-obvious choice. Newest last. Keep each under a screen.
Format: context → decision → consequences. Supersede rather than edit.

---

## ADR-0001 — Local-first storage in SQLite

**Date:** 2026-09-08 · **Status:** superseded by ADR-0003

**Context.** money-trail handles a complete picture of one person's finances. Any hosted
component turns that into a breach target and a compliance question, for no user benefit at
single-user scale.

**Decision.** The ledger is a local SQLite database (`better-sqlite3`, synchronous), owned by
the user, under `~/.money-trail/`. No server, no cloud sync, no hosted component. Reporting,
import, and categorization work with the network off.

**Consequences.** No multi-device sync (the user copies the file). No ORM — repositories
write SQL directly. Backups are the user's responsibility; document that in the README.

**Superseded 2026-09-08.** The product is now a web app and PWA, which cannot run
`better-sqlite3` in a browser and cannot hold Plaid secrets client-side. The ledger moves
server-side to Postgres — see ADR-0003. What survives: no ORM, plain SQL in repositories,
and the privacy posture (no telemetry, no data sold or shared, one outbound destination).

---

## ADR-0002 — Bank data via Plaid, read-only, credentials handled by Link

**Date:** 2026-09-08 · **Status:** accepted

**Context.** File exports alone make the tool tedious: the user re-downloads a CSV per
account per month. Pulling transactions directly from their banks is the point of the
product. Doing that means either scraping banks ourselves — which requires holding the
user's banking credentials — or using an aggregator.

**Decision.** Use Plaid, in v3, with three hard limits:

1. **We never handle bank credentials.** Plaid Link collects them inside Plaid's own UI and
   returns a public token, which we exchange for an access token. No bank password field in
   our app, no credentials in parameters, env vars, config, or the database — ever.
2. **Read-only.** Only `/link/token/create`, `/item/public_token/exchange`, `/accounts/get`,
   `/transactions/sync`, `/institutions/*`. No payment, transfer, or funds-movement
   endpoint, now or later.
3. **One network boundary.** All Plaid I/O lives in `src/providers/plaid/`; nothing else
   imports the SDK. Plaid is the only outbound destination in the app — no telemetry, no
   analytics, no other third-party call.

Access tokens are stored encrypted at rest, mode `0600`, and are never logged or printed.

**Why late and not v1.** A sync repeatedly re-pulls overlapping date ranges, so it is only safe
on top of v2's idempotent writes and content-hash dedupe. Building it earlier means building
dedupe under time pressure, against live data, with duplicates already in the ledger.

**Consequences.** A Plaid account and credentials are needed (sandbox first, then production
access). Link needs a browser surface, which the web client provides directly — the CLI-era
localhost-callback question is moot (see ADR-0003), though OAuth redirects inside an
installed iOS PWA still need real-device testing, tracked in `STATUS.md`. We inherit Plaid's rate limits,
re-auth flow (`ITEM_LOGIN_REQUIRED`), and outage surface, all handled in the provider layer.
Tests run offline against recorded sandbox fixtures. Reconciling a transaction seen both in a
CSV import and a sync is an open question, tracked in `BACKLOG.md`.

**Alternatives rejected.** Scraping banks directly (we would hold credentials — disqualifying).
Other aggregators (MX, Finicity, TrueLayer) — reconsider only if Plaid's institution coverage
or pricing fails us; the provider-layer boundary is what keeps that swap cheap.
File exports only (the status quo; too tedious to be used).


---

## ADR-0003 — Web app + installable PWA, server-owned ledger, Postgres

**Date:** 2026-09-08 · **Status:** accepted · **Supersedes:** ADR-0001

**Context.** The product needs to run on a phone. A CLI does not. Two things then follow
immediately and are not negotiable: a browser cannot run `better-sqlite3`, and a browser
cannot hold `PLAID_SECRET` or a Plaid access token — anything shipped to the client is
public. Both pillars of ADR-0001 ("no server", "SQLite on the user's machine") fail.

**Decision.** Build a React/Vite client against a Fastify API, delivered as an installable
PWA rather than a native app.

- **The server owns the ledger.** Postgres via `pg`, plain SQL, no ORM. The client holds
  only what it is currently displaying, plus a v3 read-only cache.
- **The PWA is the mobile story.** One codebase, no app stores, no native builds. Accepted
  cost: no native-only capabilities, and iOS support lags — assume Safari 16.4+.
- **Progressive enhancement.** The app must work in a plain mobile browser tab before it
  works installed. The service worker is an enhancement (v3), never a prerequisite.
- **Multi-user from v2.** Sessions in httpOnly cookies; every repository method takes
  `userId` first and scopes its query; `userId` comes from the session only.
- **All Plaid I/O is server-side** (amending ADR-0002 for a browser client): the server
  mints the `link_token`, the client passes only that to Link, and the server exchanges the
  `public_token`. Access tokens never reach the client.

**Consequences.** We now operate a server and a database — deployment, backups, migrations,
and uptime become ours. The threat model changes from "one user's laptop" to "a hosted
database of many users' financial data", which is why per-user isolation gets its own gate
criterion in v2 rather than being assumed. Offline is read-only through v4; an offline write
queue is v5 at the earliest, because iOS lacks Background Sync. Plaid OAuth redirects in an
installed iOS PWA can return to Safari instead of the app — flagged in `STATUS.md` to test
on a real device early in v4. Phase numbering shifted: bank sync moved from v3 to v4.

**Alternatives rejected.** A native app (two more codebases, app-store review, no benefit at
this scale). Local-first in the browser with IndexedDB and sync (browser storage is evictable
and cannot hold Plaid secrets — it would need the server anyway, plus a sync engine).
Keeping SQLite server-side (workable if we always self-host on a persistent disk; Postgres
costs little more and does not constrain where we deploy — revisit if we commit to
single-tenant self-hosting).


---

## ADR-0004 — Checking accounts only; signed amounts, negative = money out

**Date:** 2026-09-29 · **Status:** accepted

**Context.** The product is a daily-expense tracker across several checking accounts, not a
net-worth tool. Amount sign had to be settled before `domain/transaction.ts` exists, because
every parser, every aggregation, and the v4 Plaid mapper depend on it, and changing it later
means re-importing every transaction.

Credit cards were the hard case: a charge increases what you owe, so "money out" and
"balance up" point in opposite directions, and a card's ledger mixes spending with
statement payments that would double-count against the checking account that paid them.

**Decision.**

1. **Checking (depository) accounts only.** Parsers reject non-checking exports. In v4,
   Link is configured for `depository`/`checking` and the mapper drops other account types.
2. **Amounts are signed integer cents: negative = money out, positive = money in.** No
   unsigned amount, no `direction` column. Summing any set of rows yields net cash flow.

**Consequences.** Excluding cards removes transfer/payment double-counting from v1 and v2
entirely — a real simplification for the dedupe work, not just less surface area. Most
checking CSV exports already use this sign convention, so parsers largely pass through;
Plaid reports depository outflows as *positive*, so the v4 mapper negates — one negation in
one file, covered by the mapper's 100% coverage requirement. Category totals are negative in
the database and get flipped at the view edge; the summary screen must do this exactly once.

**Revisit when** the user wants card spending. That is not a parser task: it needs a decision
about balance-vs-flow semantics and about matching card payments against the checking
outflow that funded them, so it gets its own ADR.


---

## ADR-0005 — Categories are Plaid PFC primaries

**Date:** 2026-09-29 · **Status:** accepted

**Context.** `transactions.category` is already a `TEXT` column (migration 0001), and the
rule engine is the next service to be written. Whatever vocabulary it assigns becomes stored
data: changing it later means a migration over every row plus a rewrite of every rule. Plaid
arrives in v4 with its own taxonomy, so the choice is really "adopt theirs now" or "own a
translation table forever".

**Decision.** Use Plaid's Personal Finance Category **primary** values as the canonical
vocabulary, stored verbatim as `SCREAMING_SNAKE` strings, from v1 onward — assigned by the
CSV rule engine before any Plaid code exists.

- Primaries only. Plaid's `detailed` sub-categories are not stored; revisit in v5 if the
  summary screen needs more resolution.
- `NULL` means uncategorized. There is no `OTHER` bucket — an unmatched rule leaves `NULL`
  so gaps stay visible instead of hiding in a catch-all.
- Human-readable labels ("Food & drink") live only in `src/web/`. The database and rule
  files hold constants.

**The list** (16 primaries, as of writing): `INCOME`, `TRANSFER_IN`, `TRANSFER_OUT`,
`LOAN_PAYMENTS`, `BANK_FEES`, `ENTERTAINMENT`, `FOOD_AND_DRINK`, `GENERAL_MERCHANDISE`,
`HOME_IMPROVEMENT`, `MEDICAL`, `PERSONAL_CARE`, `GENERAL_SERVICES`,
`GOVERNMENT_AND_NON_PROFIT`, `TRANSPORTATION`, `TRAVEL`, `RENT_AND_UTILITIES`.

> This list was written from memory, not read from Plaid's docs. **Verify it against Plaid's
> published taxonomy before the rule engine ships** — it is tracked as a v1 backlog item. The
> decision (adopt their primaries) holds regardless of what the verification turns up.

**Consequences.** v4 needs no category mapping and no recategorization migration — Plaid's
values land directly in the column the rule engine has been filling all along. Costs: the
constants are generic and shouty, so the client carries a display-label map; a few primaries
(`LOAN_PAYMENTS`) will rarely appear in a checking-only ledger; and if Plaid adds a primary,
we must store the unknown value rather than drop it (v4 backlog item). Rejected: a custom
ten-category list (nicer UI, but buys a permanent Plaid→ours mapping table that silently
degrades when their taxonomy changes) and free-form tags (the v1 summary screen needs a
stable set to group by).


**Verified 2026-10-03.** Read against Plaid's published taxonomy CSV
(`plaid.com/documents/pfc-taxonomy-all.csv`): the 16 primaries above are exactly PFCv1's
primaries — the list was right. The decision stands. One thing the verification surfaced:
the file carries two taxonomies, and per its own note, *new Plaid customers after December
2025 default to PFCv2*, a superset of v1 that adds `LOAN_DISBURSEMENTS` and `OTHER`. Plaid
accepts a `personal_finance_category_version` parameter to pin v1. A v4 sync on a new
account will therefore return `OTHER` unless we pin v1 or map it; `OTHER` collides with
"no OTHER bucket", so v4 must choose (tracked in `BACKLOG.md`). v1 is unaffected — the CSV
rule engine assigns only the 16.

---

## ADR-0006 — Layered transaction identity, not a content hash

**Date:** 2026-09-29 · **Status:** accepted · **Amends:** the v2 scope in `CLAUDE.md`

**Context.** `CLAUDE.md` originally specified "content-hash dedupe" for v2. Two cases break
it, and both are normal for a checking-account expense tracker rather than edge cases:

- **Identical repeats.** Two $3.50 coffees, same shop, same day, same account hash
  identically. A content hash calls them one transaction and drops the second — silent data
  loss in a ledger, the worst failure mode available.
- **Pending → posted** (v4). Plaid returns a pending transaction, then the posted one under
  a different id and frequently a different amount (restaurant tips, fuel holds). Different
  hash, counted twice.

**Decision.** Three layers, each doing one job:

1. **File level.** Hash the uploaded file; re-importing the identical file is a no-op. This
   covers the common "did I already upload this?" case cheaply.
2. **Row level, imported.** Identity is
   `(source, account, date, amount_cents, description, occurrence_index)`, where
   `occurrence_index` distinguishes identical rows within one date and account.
3. **Row level, provider (v4+).** Identity is `(source, external_id)` — Plaid's
   `transaction_id`. Pending reconciles to posted via `pending_transaction_id`, never by
   comparing content.

Posted-only through v3; CSV exports carry no pending rows. Whether to store pending at all
is a v4 decision, deliberately left open.

**Consequences.** `source`, nullable `external_id`, and `occurrence_index` arrive as
migration `0002-add-transaction-identity.sql` — `0001` is already committed and applied, so
it is not editable. The transaction repository was written before this decision and must be
revisited to carry the new columns; the CSV parser (step 4) depends on that shape, so `0002`
comes first. `occurrence_index` must be computed at import time against rows already stored,
not merely within the incoming file, or re-importing an overlapping date range double-counts.
v2's gate gains a second regression test: two identical same-day transactions must both
survive. Adding the columns now means v4 needs no backfill. Rejected: a bare content hash
(the two bugs above) and file-level-only dedupe with a manual duplicate-review screen (pushes
judgment onto the user and costs a UI surface v1 does not need).


---

## ADR-0007 — GitHub Actions runs the full gate, including e2e

**Date:** 2026-09-29 · **Status:** accepted

**Context.** Every phase gate in `CLAUDE.md` is phrased as "some command passes", and until
now the only thing running those commands was whoever happened to be at the keyboard. The
repo has a remote, so there is somewhere for CI to run. The complication is that this
project's tests are not a single `vitest` invocation: integration tests need Postgres, and
e2e needs Playwright browsers.

**Decision.** One GitHub Actions workflow on every push and pull request:

- `lint`, `typecheck`, and unit + integration tests against a `postgres:16` service
  container;
- Playwright e2e at mobile viewport as a **parallel** job, not a downstream one;
- npm and Playwright browser binaries cached.

CI is the authority on gate criteria. A red run means the task is not done — not a reason to
disable the job.

**Why e2e in CI rather than local-only.** It is the expensive job and the tempting one to
cut. But v3's gate is almost entirely e2e-shaped — offline cold launch, the update prompt,
cache purge on logout — and an e2e suite that only runs when someone remembers is an e2e
suite that is already broken by the time it matters. Better to pay the minutes now, while
the suite is small enough that the workflow is easy to write.

**Consequences.** A slower push loop (mitigated by caching and parallel jobs) and Actions
minutes. Branch protection should require these checks before the repo has collaborators,
not after. Rejected: fast-checks-only with local e2e (the v3 gate depends on e2e staying
alive), a pre-push hook (skippable with `--no-verify`, absent on a fresh clone), and
deferring CI to v2 (the workflow only gets harder to write as the suite grows).


---

## ADR-0008 — "Read-only" means no funds movement, not no writes

**Date:** 2026-09-29 · **Status:** accepted · **Amends:** ADR-0002 and the v4 allowlist

**Context.** ADR-0002 and `CLAUDE.md` said "read-only, always" and listed five permitted
Plaid endpoints, while the same documents promised an in-app re-auth prompt and implied
users could manage their connected banks. Those cannot both hold:

- Disconnecting a bank requires `POST /item/remove`. It is a write — it revokes the access
  token — but it moves no money. Without it, "disconnect" can only delete our local copy
  while Plaid keeps reading the user's bank on a live token.
- Re-auth after `ITEM_LOGIN_REQUIRED` needs `/link/token/create` in update mode. Already on
  the list, but the wording read as initial-link only.

**Decision.** The promise is **read-only with respect to money**. The allowlist becomes:
`/link/token/create` (initial *and* update mode), `/item/public_token/exchange`,
`/accounts/get`, `/transactions/sync`, `/institutions/*`, `/item/remove`. Every payment,
transfer, and funds-movement endpoint stays prohibited outright — no exception, no flag, no
test-only carve-out. Adding anything to the allowlist requires an ADR.

Ordering rule: `/item/remove` is called **before** the local record is deleted, and account
deletion removes every item first. A local delete that leaves a live token behind is a bug.

**Consequences.** Users can actually disconnect a bank, and disconnecting genuinely revokes
our access rather than merely hiding it — which also stops Plaid billing for that item. The
allowlist stays a real constraint: it is short, and every entry is justified here. A failed
`/item/remove` must block the local delete, so the disconnect flow needs error handling and
a test for the orphaned-token case (v4 backlog). Rejected: dropping `/item/remove` and
deleting only locally (leaves a live connection to the user's bank — the wrong trade), and
replacing the allowlist with a general "no funds movement" rule (the list makes each new
endpoint a visible decision instead of something added mid-debugging).


---

## ADR-0009 — The app sends no email; password reset is manual

**Date:** 2026-09-29 · **Status:** accepted

**Context.** `CLAUDE.md` promises Plaid is the single outbound destination, and v2 adds real
multi-user auth. Self-service password reset needs outbound mail — a second destination and
usually a second vendor holding users' email addresses. Worth being clear about what a reset
email is: a link that logs someone in. Whoever reads that mail owns the account, so this is
an account-recovery security decision, not a plumbing choice.

The app currently deploys locally only and has exactly one user: its author.

**Decision.** No outbound email of any kind in v2 — no verification, no reset links, no
notifications. Signup takes an email as an identifier without verifying it. A forgotten
password is reset by hand: a documented script that writes a new argon2id hash for a given
address. The one-outbound-destination rule stays literally true.

**Consequences.** v2's auth is knowingly incomplete, and this ADR is where that is written
down rather than discovered later. It does not survive real users: adding reset to accounts
whose addresses were never verified is a retrofit, so the trigger for revisiting is "anyone
but the author has an account", not a date. Passkeys were considered as a way to sidestep
reset entirely — the code is cheap, but WebAuthn's secure-context requirement breaks
LAN-IP device testing and leaves iOS without automated coverage, so it is deferred to
v3's real-device work rather than rejected (see `BACKLOG.md`, Considered and deferred).

**Rejected.** A transactional email provider now (a second vendor with users' addresses, a
paid account, and another failure mode in signup, for a single-user app). Self-hosted SMTP
(deliverability becomes an ongoing problem, and reset mail in spam means lockouts).


---

## ADR-0010 — Self-service account deletion and JSON export in v2

**Date:** 2026-09-29 · **Status:** accepted

**Context.** Migration `0001` already cascades `transactions` from `users`, so the database
half of deletion exists. Two things were undecided: whether deletion and export are product
features or manual chores, and when they land. v4 raises the stakes — deleting a user who
has connected banks must call `/item/remove` for each item first (ADR-0008), or we delete
our record of a connection that stays live against their bank.

Export carries its own weight: this app holds a complete picture of someone's spending, and
without an export the only exit is abandoning the data. While deployment is local-only, it
is also the only backup that exists.

**Decision.** Both ship in v2.

- `DELETE /api/account` — password re-entry required, cascades to transactions, destroys the
  session. The v2 gate gains a criterion: a test asserting zero rows remain in every table,
  not merely a 200 response.
- `GET /api/export` — the full ledger as JSON, scoped by session user.

**Consequences.** The deletion path gets written while there is nothing to orphan; v4 then
adds an `/item/remove` loop to a path that already works and already has a test, rather than
building both at once under more constraints. Export gives a real backup for a local-only
deployment. Every table added after this inherits an obligation: extend the deletion test,
or it silently leaks rows. Rejected: deferring both to v5 (the deletion path only gets harder
as tables and Plaid items accumulate, and a lost dev database would be a total loss in the
meantime) and export-only (cheaper by about an hour, but leaves the v4 sequencing problem
exactly where it was).
