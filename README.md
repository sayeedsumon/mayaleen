# Mayaleen Booking Platform

Booking, reservation and management system plus public website for the Mayaleen houseboat
(Kaptai Lake). See [docs/PLAN.md](docs/PLAN.md) for the phased build plan.

## Local setup

```bash
npm install
docker compose up -d db          # or any Postgres 16
cp .env.example .env        # set SESSION_SECRET and FIELD_ENCRYPTION_KEY (openssl rand -hex 32)
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

- Phase 0 (foundation) and Phase 1 (core engine): done.
- Phase 2 (admin panel): mostly done. Staff sign-in with roles, dashboard, calendar and timeline,
  booking search/CSV export, create/change/approve/reject/cancel, bank-payment verification with
  duplicate check, refunds, food packages, check-in/out with encrypted NIDs, manifest and kitchen
  sheet, printable invoice, bank accounts, audit log.
- Still to do in Phase 2: staff 2FA enrolment screen, PDF generation (print to PDF works today).
- Next: Phase 3, public website.

First login (local): mobile `01700000000`, password `changeme-dev`. Set `ADMIN_PASSWORD` before seeding anywhere real.
