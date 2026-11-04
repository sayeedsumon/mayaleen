import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/server/auth/password";
import { DEFAULT_AGE_BANDS, DEFAULT_RATES, DEFAULT_SETTINGS } from "../src/domain/defaults";

const prisma = new PrismaClient();

async function main() {
  const types = await Promise.all(
    ["Standard", "Couple", "Premium"].map((name) =>
      prisma.cabinType.upsert({ where: { name }, update: {}, create: { name } }),
    ),
  );
  const t = Object.fromEntries(types.map((x) => [x.name, x.id]));
  // Placeholder layout: owner edits cabins in the admin panel (FR-A21).
  const cabins = [
    ["Cabin 1", "Standard", 4], ["Cabin 2", "Standard", 4], ["Cabin 3", "Couple", 4], ["Cabin 4", "Premium", 4],
  ] as const;
  for (const [i, [name, type, capacity]] of cabins.entries()) {
    await prisma.cabin.upsert({
      where: { name }, update: {}, create: { name, cabinTypeId: t[type], capacity, sortOrder: i },
    });
  }
  if ((await prisma.boatSetting.count()) === 0) {
    await prisma.boatSetting.create({ data: { ...DEFAULT_SETTINGS, effectiveFrom: new Date("2020-01-01") } });
  }
  if ((await prisma.rateRule.count()) === 0) {
    for (const [pkg, byDay] of Object.entries(DEFAULT_RATES)) {
      for (const [dayType, amount] of Object.entries(byDay)) {
        await prisma.rateRule.create({
          data: { packageType: pkg as never, dayType: dayType as never, amount, effectiveFrom: new Date("2020-01-01") },
        });
      }
    }
  }
  let min = 0;
  for (const b of [...DEFAULT_AGE_BANDS].reverse()) {
    const range = b.isAdult ? [11, 120] : b.pctOfAdult === 0 ? [0, 3] : [4, 10];
    await prisma.ageBand.upsert({
      where: { name: b.name }, update: {},
      create: { name: b.name, minAge: range[0], maxAge: range[1], pctOfAdult: b.pctOfAdult, isAdult: b.isAdult },
    });
    min = range[1];
  }
  void min;
  // Fixed-date national holidays only. Islamic holidays move with the moon: owner imports the gazette (FR-A23).
  const holidays: [string, string][] = [
    ["2027-02-21", "Shaheed Day"], ["2027-03-26", "Independence Day"], ["2027-04-14", "Pohela Boishakh"],
    ["2027-05-01", "May Day"], ["2027-12-16", "Victory Day"], ["2027-12-25", "Christmas Day"],
  ];
  for (const [d, name] of holidays) {
    await prisma.holiday.upsert({ where: { date: new Date(`${d}T00:00:00Z`) }, update: {}, create: { date: new Date(`${d}T00:00:00Z`), name } });
  }
  // First admin. Set ADMIN_PASSWORD in production; the dev default is for local use only.
  if ((await prisma.user.count()) === 0) {
    const pw = process.env.ADMIN_PASSWORD ?? "changeme-dev";
    await prisma.user.create({
      data: { name: "Owner", mobile: process.env.ADMIN_MOBILE ?? "01700000000", role: "ADMIN", pwHash: hashPassword(pw) },
    });
    console.log(`Created admin ${process.env.ADMIN_MOBILE ?? "01700000000"}${process.env.ADMIN_PASSWORD ? "" : " with the DEV default password: change it"}`);
  }
  if ((await prisma.bankAccount.count()) === 0) {
    await prisma.bankAccount.create({
      data: { bank: "TBD", branch: "TBD", accountName: "Mayaleen", accountNo: "TBD", routingNo: "TBD", isDefault: true },
    });
  }
}

main().finally(() => prisma.$disconnect());
