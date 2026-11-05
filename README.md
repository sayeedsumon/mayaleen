# Mayaleen Booking Platform

Booking, reservation and management system plus public website for the Mayaleen houseboat
(Kaptai Lake). See [docs/PLAN.md](docs/PLAN.md) for the phased build plan.

**Installing?** Step-by-step guide for non-coders (your computer, cPanel, VPS): [docs/INSTALL.md](docs/INSTALL.md).
Hosting on Vercel + Neon: [docs/DEPLOY.md](docs/DEPLOY.md).

## Local setup

Easiest (needs Node 20+ and Docker running):

```bash
npm run setup && npm run dev
```

Then open http://localhost:3000/admin/login. Manual steps:

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

- Phase 0–1 (foundation, core engine): done.
- Phase 2 (admin panel): done, rebuilt on the Mayaleen design (lake teal, sand, Fraunces + Inter).
  - Today: action queue with inline approve, next boarding checklist, next 7 nights, activity.
  - Calendar: book straight from a date (cabins, guests, food, live price, discount with reason, approve now), block/unblock dates.
  - Timeline: pick cabins on a night and book them together.
  - Bookings list with status tabs and next step; booking detail with progress, payments, refunds, food, change, extend, cancel, no-show.
  - Boarding: check-out with notes, check-in with NID per adult (validated), cabin per guest, emergency contact.
  - Manifest and kitchen sheet (printable). Invoices: list, editor (lines, discounts, terms, deadlines), revisions, printable PDF.
  - Payments: proof verification with duplicate and amount checks, bank payments, refunds.
  - Guests with history and notes. Reports: invoiced, collected, outstanding, occupancy, day type, package, source.
  - Settings: rates with effective dates, holidays (+ gazette import), special prices, cabins and types, booking rules,
    bank accounts, staff and roles, password change, two-step sign-in, audit log.
- Next: Phase 3, public website and guest My Booking page (with proof upload).

Schema changes are applied with `npx prisma db push` locally; for Neon, see `prisma/sql/` for the SQL that was applied.
