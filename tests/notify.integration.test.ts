import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { createBooking } from "@/server/booking-service";
import * as wf from "@/server/workflow-service";
import { sendReminders } from "@/server/notify";
import { guestBooking, publicMonth } from "@/server/queries";
import { resetBookings } from "./helpers";

const NOW = new Date("2026-12-01T06:00:00Z");
const lead = { name: "Rafi", mobile: "01712345678", nid: "1990000000001", email: "rafi@example.com" };
const adults = (n: number) => [{ band: "Adult", count: n }];

beforeEach(async () => {
  await resetBookings();
  await prisma.message.deleteMany();
});

describe("message outbox (PRD §11)", () => {
  it("a request queues the guest SMS + email (N-01) and a manager SMS (N-02); without a gateway they are LOGGED", async () => {
    const b = await createBooking({ type: "FULL_BOAT", tripDate: "2026-12-08", channel: "ONLINE", lead, guests: adults(4), foodGuests: [], now: NOW });
    const msgs = await prisma.message.findMany({ where: { bookingId: b.id } });
    expect(msgs.filter((m) => m.event === "N-01").map((m) => m.channel).sort()).toEqual(["EMAIL", "SMS"]);
    expect(msgs.some((m) => m.event === "N-02:staff")).toBe(true);
    expect(msgs.every((m) => m.status === "LOGGED")).toBe(true);
    expect(msgs.find((m) => m.event === "N-01" && m.channel === "SMS")!.body).toContain(b.reference);
    expect(msgs.find((m) => m.event === "N-01")!.body).toContain(`/booking/${b.accessToken}`);
  });

  it("approval, advance and balance send N-03, N-07, N-08; reminders are not duplicated", async () => {
    const b = await createBooking({ type: "FULL_BOAT", tripDate: "2026-12-08", channel: "ONLINE", lead, guests: adults(4), foodGuests: [], now: NOW });
    const inv = await wf.approveBooking(b.id, "m", { paymentOption: "ADVANCE", now: NOW });
    await wf.recordManualPayment(b.id, { amount: inv.dueNow }, "m", NOW);
    await wf.recordManualPayment(b.id, { amount: inv.balance }, "m", NOW);
    const events = (await prisma.message.findMany({ where: { bookingId: b.id, channel: "SMS", to: lead.mobile } })).map((m) => m.event);
    expect(events).toEqual(expect.arrayContaining(["N-01", "N-03", "N-07", "N-08"]));
    // day-before reminder runs once even if the cron runs twice
    await sendReminders(new Date("2026-12-07T04:00:00Z"));
    await sendReminders(new Date("2026-12-07T05:00:00Z"));
    expect(await prisma.message.count({ where: { bookingId: b.id, event: "N-12", channel: "SMS" } })).toBe(1);
  });

  it("Bangla bookings get Bangla messages", async () => {
    const b = await createBooking({ type: "FULL_BOAT", tripDate: "2026-12-08", channel: "ONLINE", lead, guests: adults(4), foodGuests: [], language: "bn", now: NOW });
    const m = await prisma.message.findFirstOrThrow({ where: { bookingId: b.id, event: "N-01", channel: "SMS" } });
    expect(m.body).toContain("মায়ালীন");
  });
});

describe("public data", () => {
  it("public month has no guest names", async () => {
    await createBooking({ type: "FULL_BOAT", tripDate: "2026-12-08", channel: "ONLINE", lead, guests: adults(4), foodGuests: [], now: NOW });
    const m = await publicMonth("2026-12");
    expect(JSON.stringify(m)).not.toContain("Rafi");
    expect(m.days.find((d) => d.date === "2026-12-08")!.bookings[0].type).toBe("FULL_BOAT");
  });
  it("guest booking page rejects malformed tokens and finds real ones", async () => {
    const b = await createBooking({ type: "FULL_BOAT", tripDate: "2026-12-08", channel: "ONLINE", lead, guests: adults(4), foodGuests: [], now: NOW });
    expect(await guestBooking("../etc")).toBeNull();
    expect(await guestBooking("x".repeat(30))).toBeNull();
    expect((await guestBooking(b.accessToken))?.reference).toBe(b.reference);
  });
});
