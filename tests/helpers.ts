import { prisma } from "@/server/db";

/** Wipe all booking data (keeps seeded cabins, rates, settings). */
export async function resetBookings() {
  await prisma.auditLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.cabinNight.deleteMany();
  await prisma.bookingLine.deleteMany();
  await prisma.bookingGuest.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.dateBlock.deleteMany();
}
