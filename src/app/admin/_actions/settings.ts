"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { DayType, PackageType, Role } from "@prisma/client";
import { RuleError } from "@/domain";
import { requireUser } from "@/server/auth/current-user";
import { prisma } from "@/server/db";
import * as s from "@/server/settings-service";
import { bool, fail, int, str, withParam } from "../_lib/form";

function finish(path: string, msg: string): never {
  revalidatePath("/admin", "layout");
  redirect(withParam(path, "ok", msg));
}

const PKG: PackageType[] = ["SHARED", "FULL_BOAT", "FULL_BOAT_FOOD"];
const DAY: DayType[] = ["SUN_WED", "THU_SAT", "FRIDAY", "HOLIDAY"];

export async function saveRatesAction(form: FormData) {
  const u = await requireUser("ADMIN_SETTINGS");
  const back = "/admin/settings/rates";
  try {
    const rates = Object.fromEntries(PKG.map((p) => [p, Object.fromEntries(DAY.map((d) => [d, int(form, `${p}_${d}`)]))])) as Record<PackageType, Record<DayType, number>>;
    await s.saveRates(str(form, "effectiveFrom"), rates, u.id);
  } catch (e) { fail(back, e); }
  finish(back, "New rates saved. They apply to new quotes from the effective date.");
}

export async function holidayAction(form: FormData) {
  const u = await requireUser("ADMIN_SETTINGS");
  const back = "/admin/settings/rates#holidays";
  try {
    if (str(form, "remove")) await s.removeHoliday(str(form, "remove"), u.id);
    else if (str(form, "bulk")) {
      const n = await s.importHolidays(str(form, "bulk"), (str(form, "source") || "gazette") as "gazette", u.id);
      finish(back, `${n} holidays imported`);
    } else await s.addHoliday(str(form, "date"), str(form, "name"), (str(form, "source") || "expected") as "expected", u.id);
  } catch (e) { fail(back, e); }
  finish(back, "Holidays updated");
}

export async function overrideAction(form: FormData) {
  const u = await requireUser("ADMIN_SETTINGS");
  const back = "/admin/settings/rates#overrides";
  try {
    if (str(form, "remove")) await s.removeOverride(str(form, "remove"), u.id);
    else await s.saveOverride(str(form, "date"), str(form, "packageType") as PackageType, int(form, "amount"), u.id);
  } catch (e) { fail(back, e); }
  finish(back, "Special prices updated");
}

export async function cabinAction(form: FormData) {
  const u = await requireUser("ADMIN_SETTINGS");
  const back = "/admin/settings/cabins";
  try {
    await s.saveCabin({
      id: str(form, "id") || undefined, name: str(form, "name"), cabinTypeId: str(form, "cabinTypeId"),
      capacity: int(form, "capacity"), active: str(form, "id") ? bool(form, "active") : true,
      sortOrder: str(form, "sortOrder") ? int(form, "sortOrder") : undefined,
    }, u.id);
  } catch (e) { fail(back, e); }
  finish(back, "Cabin saved");
}

export async function cabinTypeAction(form: FormData) {
  const u = await requireUser("ADMIN_SETTINGS");
  const back = "/admin/settings/cabins";
  try {
    await s.saveCabinType({ id: str(form, "id") || undefined, name: str(form, "name"), surcharge: int(form, "surcharge") }, u.id);
  } catch (e) { fail(back, e); }
  finish(back, "Cabin type saved");
}

export async function rulesAction(form: FormData) {
  const u = await requireUser("ADMIN_SETTINGS");
  const back = "/admin/settings/rules";
  try {
    await s.saveRules({
      capacityCap: int(form, "capacityCap"), approvalWindowHours: int(form, "approvalWindowHours"),
      paymentWindowHours: int(form, "paymentWindowHours"), balanceLeadHours: int(form, "balanceLeadHours"),
      cutoffDays: int(form, "cutoffDays"), horizonMonths: int(form, "horizonMonths"), advancePct: int(form, "advancePct"),
      minBillablePerCabin: int(form, "minBillablePerCabin"), groupTierEnabled: bool(form, "groupTierEnabled"),
      groupTierMinGuests: int(form, "groupTierMinGuests"), groupTierRate: int(form, "groupTierRate"),
    }, u.id);
  } catch (e) { fail(back, e); }
  finish(back, "Booking rules saved");
}

export async function saveBankAccountAction(form: FormData) {
  const user = await requireUser("ADMIN_SETTINGS");
  const back = "/admin/settings/bank";
  const data = {
    bank: str(form, "bank"), branch: str(form, "branch"), accountName: str(form, "accountName"),
    accountNo: str(form, "accountNo"), routingNo: str(form, "routingNo"),
  };
  const id = str(form, "id");
  try {
    if (Object.values(data).some((v) => !v)) throw new RuleError("REQUIRED", "Fill in every bank field");
    const acct = id
      ? await prisma.bankAccount.update({ where: { id }, data: { ...data, active: bool(form, "active") } })
      : await prisma.bankAccount.create({ data: { ...data, isDefault: false } });
    if (bool(form, "isDefault")) {
      await prisma.$transaction([
        prisma.bankAccount.updateMany({ data: { isDefault: false } }),
        prisma.bankAccount.update({ where: { id: acct.id }, data: { isDefault: true, active: true } }),
      ]);
    }
    await prisma.auditLog.create({ data: { entity: "BankAccount", entityId: acct.id, action: id ? "UPDATED" : "CREATED", actor: user.id } });
  } catch (e) { fail(back, e); }
  finish(back, "Bank account saved. New invoices use it.");
}

export async function staffAction(form: FormData) {
  const u = await requireUser("ADMIN_SETTINGS");
  const back = "/admin/settings/staff";
  try {
    const id = str(form, "id");
    if (!id) {
      await s.createStaff({ name: str(form, "name"), mobile: str(form, "mobile").replace(/[^0-9]/g, ""), role: str(form, "role") as Role, password: str(form, "password") }, u.id);
    } else if (str(form, "password")) {
      await s.resetStaffPassword(id, str(form, "password"), u.id);
    } else {
      await s.updateStaff(id, { role: str(form, "role") as Role, active: bool(form, "active") }, u.id);
    }
  } catch (e) { fail(back, e); }
  finish(back, "Staff updated");
}

export async function changePasswordAction(form: FormData) {
  const u = await requireUser();
  const back = "/admin/settings/account";
  try {
    if (str(form, "next") !== str(form, "confirm")) throw new RuleError("MISMATCH", "The two new passwords do not match");
    await s.changeOwnPassword(u.id, str(form, "current"), str(form, "next"));
  } catch (e) { fail(back, e); }
  finish(back, "Password changed");
}

export async function twoFactorAction(form: FormData) {
  const u = await requireUser();
  const back = "/admin/settings/account";
  const step = str(form, "step");
  try {
    if (step === "start") await s.startTotp(u.id);
    else if (step === "confirm") await s.confirmTotp(u.id, str(form, "code"));
    else if (step === "disable") await s.disableTotp(u.id, str(form, "password"));
  } catch (e) { fail(back, e); }
  finish(back, step === "start" ? "Scan the code in your authenticator app, then enter the 6 digits" : step === "confirm" ? "Two-step sign-in is on" : "Two-step sign-in is off");
}

export async function guestNotesAction(guestId: string, form: FormData) {
  const u = await requireUser("VIEW_OPERATIONS");
  const back = `/admin/guests?id=${guestId}`;
  try {
    await s.saveGuestNotes(guestId, str(form, "notes"), u.id);
  } catch (e) { fail(back, e); }
  finish(back, "Notes saved");
}

export async function websiteContentAction(form: FormData) {
  const u = await requireUser("ADMIN_SETTINGS");
  const sectionId = str(form, "section");
  const back = `/admin/settings/website?s=${encodeURIComponent(sectionId)}`;
  try {
    const { FIELDS, SECTIONS, cleanRows } = await import("@/server/site-content");
    const sec = SECTIONS.find((x) => x.id === sectionId);
    if (!sec) throw new RuleError("SECTION", "Unknown section");
    for (const key of sec.keys) {
      const d = FIELDS[key];
      let en = "", bn = "";
      if (d.type === "text") {
        en = String(form.get(`${key}_en`) ?? "").trim().slice(0, 5000);
        bn = String(form.get(`${key}_bn`) ?? "").trim().slice(0, 5000);
      } else if (d.type === "toggle") {
        en = form.get(`${key}_on`) ? "1" : "0";
      } else {
        const enRows = cleanRows(form.get(`${key}_en`), d);
        const bnRows = cleanRows(form.get(`${key}_bn`), d);
        en = JSON.stringify(enRows);
        bn = JSON.stringify(enRows.map((_, i) => bnRows[i] ?? {}));
      }
      await prisma.siteContent.upsert({ where: { key }, update: { en, bn }, create: { key, en, bn } });
    }
    await prisma.auditLog.create({ data: { entity: "SiteContent", entityId: sectionId, action: "CONTENT_SAVED", actor: u.id } });
  } catch (e) { fail(back, e); }
  revalidatePath("/", "layout");
  finish(back, "Saved. The website shows it right away.");
}

/** Puts a section back to the original wording (deletes the saved values). */
export async function resetWebsiteSectionAction(form: FormData) {
  const u = await requireUser("ADMIN_SETTINGS");
  const sectionId = str(form, "section");
  const back = `/admin/settings/website?s=${encodeURIComponent(sectionId)}`;
  try {
    const { SECTIONS } = await import("@/server/site-content");
    const sec = SECTIONS.find((x) => x.id === sectionId);
    if (!sec) throw new RuleError("SECTION", "Unknown section");
    await prisma.siteContent.deleteMany({ where: { key: { in: sec.keys } } });
    await prisma.auditLog.create({ data: { entity: "SiteContent", entityId: sectionId, action: "CONTENT_RESET", actor: u.id } });
  } catch (e) { fail(back, e); }
  revalidatePath("/", "layout");
  finish(back, "Restored the original wording for this section.");
}

export async function resendMessageAction(form: FormData) {
  await requireUser("MANAGE_BOOKINGS");
  const back = "/admin/settings/messages";
  try {
    const { deliver } = await import("@/server/notify");
    await prisma.message.update({ where: { id: str(form, "id") }, data: { status: "QUEUED" } });
    await deliver(str(form, "id"));
  } catch (e) { fail(back, e); }
  finish(back, "Message sent again");
}
