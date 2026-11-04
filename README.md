# Mayaleen Booking Platform

Booking, reservation and management system plus public website for the Mayaleen houseboat
(Kaptai Lake). See [docs/PLAN.md](docs/PLAN.md) for the phased build plan.

## Local setup

```bash
npm install
docker compose up -d db          # or any Postgres 16
cp .env.example .env
npx prisma db push && npm run db:seed
npm run dev
```

## Tests

```bash
npm test      # unit tests + DB integration tests (needs Postgres; uses TEST_DATABASE_URL or mayaleen_test)
npm run typecheck
```

## Layout

- `src/domain/`: pure pricing, availability and booking-state rules (BR-01..20). No I/O.
- `src/server/`: Prisma access and the transactional booking write path.
- `prisma/`: schema and seed.
- `tests/`: rule tests, concurrency race test.

## Status

Phase 0 (foundation) and Phase 1 (core engine) done. Next: Phase 2, admin panel.
