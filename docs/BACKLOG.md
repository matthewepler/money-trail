# BACKLOG

Deferred work and known bugs. Anything that comes up mid-task but isn't in the current
phase's scope lands here instead of in the code.

**Format:** one line per item — `- [phase] description (why deferred / where it bites)`.
Bugs go in the Bugs section with a severity: `critical`, `high`, `medium`, `low`.
Critical or high bugs block the current gate.

---

## Bugs

None open. (Project not yet scaffolded.)

<!-- Example of the shape once there is code:
- [high] Amounts with a trailing `CR` suffix parse as NaN instead of a negative — `parsers/chaseCsv.ts`, fixture `chase-credit-note.csv`.
-->

---

## Deferred — v2 (resilience, auth, isolation)

- [v2] Multi-user signup, argon2id password hashing, session rotation on login, logout everywhere.
- [v2] Per-user scoping enforced in every repository method; cross-tenant access tests per route.
- [v2] CSRF tokens on mutations; security headers (CSP, HSTS, frame-ancestors, nosniff).
- [v2] Rate limiting on auth and upload routes.
- [v2] Idempotent imports: content-hash each source row, skip rows already in the ledger.
- [v2] Wrap imports in a transaction so a mid-file failure rolls back cleanly.
- [v2] Actionable validation errors with row numbers and the offending value.
- [v2] Upload limits: max file size, MIME sniffing, reject archives.
- [v2] Second bank format + auto-detection from the header row; OFX parser.
- [v2] Migration runner, plus a test migrating a v1-era database forward.
- [v2] Malformed-input fixtures for every format (bad dates, thousands separators, missing
  columns, mixed encodings, empty file, header-only file).
- [v2] Structured request logging with a request id; never log bodies.
- [v2] Decide timezone handling for dates that arrive with times attached.

## Deferred — v3 (installable PWA)

- [v3] `manifest.webmanifest`, maskable icon set, theme color, `display: standalone`.
- [v3] Service worker via vite-plugin-pwa: precached shell, network-first data reads.
- [v3] Never cache mutations, auth responses, or Plaid traffic; purge all caches on logout.
- [v3] Update prompt when a new service worker is waiting — no silent `skipWaiting`.
- [v3] Offline banner; disable network-dependent actions with an explanation.
- [v3] Safe-area insets, `dvh` units, ≥44px touch targets, correct `inputmode` per field.
- [v3] Virtualize or paginate the transaction list.
- [v3] Playwright offline e2e; Lighthouse mobile audit in CI.
- [v3] Verify install + cold offline launch on a real iOS and a real Android device.

## Deferred — v4 (live bank sync, read-only via Plaid)

- [v4] Plaid Link in the browser; `link_token` minted server-side, `public_token` exchanged
  server-side. The user enters credentials in Plaid's UI, never in ours.
- [v4] Encrypted at-rest storage for access tokens and item records, server-side only.
- [v4] `/transactions/sync` with a persisted cursor per item.
- [v4] Map Plaid transactions onto the existing domain transaction; no parallel model.
- [v4] Handle `removed` and modified transactions from the sync response.
- [v4] Re-auth flow when an item returns `ITEM_LOGIN_REQUIRED`.
- [v4] Retry with backoff for rate limits and transient failures, inside the provider layer only.
- [v4] Recorded sandbox fixtures: first sync, incremental, removed txn, expired item, rate limit.
- [v4] Test-time network guard — any real HTTP attempt fails the suite.
- [v4] Redaction test: no token or full account number reaches a log, error, or API response.
- [v4] CSP allowance for `https://cdn.plaid.com` and nothing else.
- [v4] Verify the Link flow inside the installed iOS PWA, including an OAuth institution.
- [v4] Decide reconciliation when the same transaction arrives from both a CSV import and a sync.

## Deferred — v5 (analysis and polish)

- [v5] Heuristic/learned categorization layered on the rule engine — explicit rules always win.
- [v5] Budgets and variance reporting.
- [v5] Recurring-transaction and subscription detection.
- [v5] Multi-account transfer matching (an outflow and inflow that are the same movement).
- [v5] Export to CSV/JSON.
- [v5] Push notifications for large transactions (iOS requires an installed PWA).
- [v5] Background sync jobs so a sync doesn't need the app open.
- [v5] Offline write queue (deliberately absent through v4 — offline is read-only).
- [v5] Benchmark harness (`npm run bench`) — 50k transactions under 2s.
- [v5] Feature flags so each v5 capability degrades to v4 behavior when off.

---

## Rejected / out of scope

Kept so they don't get re-proposed each session.

- Handling bank credentials ourselves — no password field, no credential storage, no
  forwarding. Plaid Link owns that step. See `DECISIONS.md` ADR-0002.
- Any Plaid payment, transfer, or funds-movement endpoint. Read-only, permanently.
- Storing session tokens in `localStorage` — httpOnly cookies only.
- Any secret in a `VITE_`-prefixed variable or anywhere under `src/web/` — Vite inlines
  those into the public bundle.
- An ORM. Repositories write SQL directly against `pg`.
- Telemetry, analytics, crash reporting, or any third-party script other than Plaid Link.
- A native iOS/Android app. The PWA is the mobile story (ADR-0003).
- Selling, sharing, or aggregating user financial data in any form.
