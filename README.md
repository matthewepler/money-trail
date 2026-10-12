# money-trail

Personal transaction tracking: upload a bank CSV, get a normalized, categorized ledger and a
spend-by-category summary. Mobile-first web app.

## Run it locally

Requires Node 20+ (`.nvmrc` pins this — `nvm use` if you have nvm) and Docker for the local
database.

```bash
docker compose up -d   # starts Postgres on localhost:5432 (Docker Desktop must be running)
cp .env.example .env   # then set SEED_PASSWORD in .env (12+ characters; this is your login)
npm install
npm run db:migrate
npm run seed           # creates the one account you sign in with
npm run dev             # api on :3000, client on :5173
```

Open `http://localhost:5173`.

`npm test` uses its own `money_trail_test` database, created automatically, so it never
touches your data.

## Development

See [CLAUDE.md](./CLAUDE.md) for the full phase plan, architecture, and conventions.
Current status: [docs/STATUS.md](./docs/STATUS.md).

```bash
npm run lint && npm run typecheck && npm test   # before considering any change done
```
