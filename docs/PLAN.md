# Mayaleen Booking Platform: Build Plan

Source: Mayaleen Houseboat Booking & Reservation System PRD v1.0 (4 Nov 2026).
This plan turns the PRD into build phases. BR-xx, FR-xx and NFR-xx refer to PRD IDs.

## 1. Stack (per PRD §14)

- **App:** one Next.js (TypeScript) app: public site (SSR) + protected `/admin`
- **DB:** PostgreSQL + Prisma
- **UI:** Tailwind CSS; FullCalendar for the admin calendar and timeline
- **i18n:** `next-intl` (bn/en); all copy, SMS and email templates are bilingual
- **Files:** S3-compatible private storage (signed, expiring URLs) for proofs, NID files, gallery
- **PDF:** server-side HTML → PDF (invoices, manifest, kitchen sheet)
- **Notifications:** provider interface with a console/dev adapter first; swap in a BD SMS gateway and an email provider later
- **Jobs:** a 5-minute scheduler (hold expiry, reminders), exposed as an authenticated cron endpoint
- **Tests:** Vitest for the domain module; Playwright for e2e
- **Auth:** staff login with roles (front desk / manager / admin) and TOTP 2FA
- **Hosting:** Singapore-region managed platform or VPS (decide at Phase 5)

## 2. Architecture rule

All pricing, availability and booking-state logic lives in one pure, well-tested
module, `src/domain/`. The website, admin and jobs all call it (NFR-10, ≥80% coverage).

```
src/
  domain/        pricing.ts, availability.ts, booking-state.ts, rules.ts (BR-01..20)
  server/        prisma, booking service (transactional write path), payments, notifications, jobs
  app/(public)/  website pages (bn/en)
  app/admin/     admin panel
  app/api/       route handlers
prisma/          schema.prisma, seed.ts
tests/           unit (BR tests), race test (NFR-02), e2e
docs/            PLAN.md
```

**Booking write path** (PRD §14): in one transaction, lock the trip date, re-check
block and mode and the rules, insert `cabin_night` rows (UNIQUE `cabin_id, trip_date`),
insert the booking, guests and price lines, then commit. On a unique-constraint conflict
return the FR-W06 "just booked" response.

## 3. Phases

The PRD says "build as soon as possible", so the plan is five phases. The admin goes live
first (R-08), then the public site. Each phase ends in something demo-able.

### Phase 0: Foundation (about 3 days)
- Next.js + TS + Tailwind + Prisma + Postgres (docker-compose for local)
- Prisma schema for all PRD §12 entities, including the `cabin_night` unique constraint
- Seed data: 4 cabins (mixed types, 16 guests), rates from §6.2, 2027 expected holidays, default settings
- Lint, format, CI (typecheck, unit tests), env config, Asia/Dhaka time helpers (BR-20)
- Staff auth with roles and 2FA

### Phase 1: Core engine (about 1.5 weeks, the correctness core)
- `pricing.ts`: day-type resolution (override → holiday → Fri → Thu/Sat → Sun–Wed), shared and full-boat quotes, child age bands, food, surcharges, discount, optional group tier and per-cabin minimum (BR-07/08/09/17/18)
- `availability.ts`: date mode, cabins free, BR-02/03/06 (last single cabin not sold), blocks, booking window (BR-14)
- `booking-state.ts`: the 10-state machine and transitions (§8)
- Transactional booking service, hold expiry, and the NFR-02 race test
- Unit tests for every BR-01..20

**Gate:** all BR tests green and the concurrency test passes before any UI depends on it.

### Phase 2: Admin panel (about 3 weeks)
- Dashboard action queue (FR-A01)
- Month calendar and cabin timeline (FR-A02/03), date blocks (FR-A04)
- Create booking for phone/Facebook leads (FR-A05); search and filters (FR-A07)
- Approve/reject (FR-A06), change a booking with re-price and revised invoice (FR-A08), extend deadlines (FR-A09), cancel/no-show/refund (FR-A10)
- Invoices and PDF (FR-A11), proof verification with duplicate-txn check (FR-A12), manual payments (FR-A13), bank accounts (FR-A14)
- Full-boat food packages (FR-A15)
- Check-in with NID capture (balance-gated), check-out, manifest, kitchen sheet (FR-A16 to A20)
- Audit log (FR-A27), encrypted NID fields and access logging (NFR-06)

**Milestone:** staff can run real bookings entirely in the system. Start the parallel run and import existing bookings here.

### Phase 3: Public website and guest flow (about 3 weeks)
- Mobile-first bn/en site: Home, Boat & Cabins, Packages & Pricing, Itinerary, Gallery, FAQ, How to reach, Terms, Contact (§9.1)
- Date search, month availability calendar and live quote (FR-W01/02)
- Shared and full-boat booking forms, lead NID, hold on submit, clash handling with 3 nearest dates (FR-W03 to W06)
- My Booking private link, with reference + mobile + OTP resend (FR-W07)
- Full/advance choice and proof upload with multiple proofs (FR-W08 to W10)
- Language switch (FR-W12), floating call/WhatsApp button (FR-W15)
- Bot protection and rate limiting on booking, OTP and upload endpoints; upload type/size checks (NFR-05)

### Phase 4: Notifications, jobs, settings, reports (about 2 weeks)
- Notification service for N-01 to N-14 with bn/en templates and the SMS/email adapters
- 5-minute job runner: hold expiry, 6 h and 48 h reminders, day-before and thank-you messages, with failure alerting
- Settings UI: cabins and types (FR-A21), rates with effective-from, overrides and quote preview (FR-A22), holidays (FR-A23), timeouts (FR-A24), staff (FR-A25)
- Reports and CSV export: occupancy, revenue, pipeline, speed, food, channels (FR-A26)
- Should-haves: guest cancellation request (FR-W11), analytics events and Facebook Pixel (FR-W14), template editor (FR-A28), site CMS (FR-W13)

### Phase 5: Hardening and launch (about 1 to 1.5 weeks)
- Accessibility pass (WCAG AA, 360 px), performance (LCP < 2.5 s)
- Virus scanning on uploads, daily backups plus a restore test, error tracking, uptime and job monitors
- Staging with seeded data; Playwright e2e of the full lifecycle
- Content gate: real photos, Bangla copy, bank details, terms text
- Production deploy, domain and SMS masking, go-live checklist

## 4. Open items that block work

| Item | Needed before |
|---|---|
| Child age bands and % rates | Phase 1 pricing |
| Premium cabin surcharge (default Tk 0) | Phase 1 (default is usable) |
| Advance % (50%) and whether it differs for full boat | Phase 1 |
| Confirm D-11 (last cabin never sold) and D-13 (NID for every adult at check-in) | Phase 1 |
| Bank account details | Phase 2 |
| Cancellation and refund terms text | Phase 3 |
| Domain, SMS mask, photos, video, reviews, Bangla copy | End of Phase 3 |
| Export of existing future bookings | Phase 2 parallel run |
| Choice of SMS gateway and email provider | Phase 4 |

Assumptions until answered: child bands are under 4 free and 4 to 10 at 50%, surcharge is
Tk 0, advance is 50% for both package types.

## 5. Out of scope for v1 (PRD §3, §5)
Online payment gateway, guest accounts, coupons, OTA sync, cancellation-policy engine,
housekeeping, accounting integration.
