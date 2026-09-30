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
