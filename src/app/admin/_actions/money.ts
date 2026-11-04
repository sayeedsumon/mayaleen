"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { RuleError, type PaymentOption } from "@/domain";
import { requireUser } from "@/server/auth/current-user";
import { prisma } from "@/server/db";
import * as wf from "@/server/workflow-service";
import { dhakaLocal, fail, int, str, withParam } from "../_lib/form";

function finish(path: string, msg: string): never {
  revalidatePath("/admin", "layout");
  redirect(withParam(path, "ok", msg));
}

export async function verifyPaymentAction(paymentId: string, form: FormData) {
  const user = await requireUser("MANAGE_BOOKINGS");
  const back = str(form, "back") || "/admin/payments";
  const reject = str(form, "decision") === "reject";
  try {
    if (reject) await wf.rejectPayment(paymentId, str(form, "reason"), user.id);
    else await wf.verifyPayment(paymentId, int(form, "received"), user.id);
  } catch (e) {
    fail(back, e);
  }
  finish(back, reject ? "Proof rejected. The guest will be asked to send it again." : "Payment verified.");
}

async function bookingByRef(ref: string) {
  const b = await prisma.booking.findUnique({ where: { reference: ref.trim().toUpperCase() } });
  if (!b) throw new RuleError("NOT_FOUND", `No booking with reference ${ref}`);
  return b;
}

export async function manualPaymentAction(form: FormData) {
  const user = await requireUser("MANAGE_BOOKINGS");
  const back = str(form, "back") || "/admin/payments";
  try {
    const id = str(form, "bookingId") || (await bookingByRef(str(form, "reference"))).id;
    await wf.recordManualPayment(id, {
      amount: int(form, "amount"), txnId: str(form, "txnId") || undefined, senderName: str(form, "sender") || undefined,
      transferAt: dhakaLocal(str(form, "transferAt")),
    }, user.id);
  } catch (e) {
    fail(back, e);
  }
  finish(back, "Bank payment recorded and verified.");
}

export async function refundAction(form: FormData) {
  const user = await requireUser("MANAGE_BOOKINGS");
  const back = str(form, "back") || "/admin/payments?tab=refunds";
  try {
    const id = str(form, "bookingId") || (await bookingByRef(str(form, "reference"))).id;
    await wf.recordRefund(id, { amount: int(form, "amount"), txnId: str(form, "txnId"), reason: str(form, "reason") }, user.id);
  } catch (e) {
    fail(back, e);
  }
  finish(back, "Refund recorded.");
}

/** Invoice editor payload: lines as JSON from the client editor. */
export async function reviseInvoiceAction(bookingId: string, form: FormData) {
  const user = await requireUser("MANAGE_BOOKINGS");
  const back = str(form, "back") || "/admin/invoices";
  let inv;
  try {
    const lines = JSON.parse(str(form, "lines")) as wf.InvoiceLineInput[];
    const due = dhakaLocal(str(form, "dueNowAt"));
    const bal = str(form, "balanceAt") ? dhakaLocal(str(form, "balanceAt")) ?? null : undefined;
    inv = await wf.reviseInvoice(bookingId, {
      lines, paymentOption: (str(form, "paymentOption") || "FULL") as PaymentOption,
      dueNowAt: due, balanceAt: bal, note: str(form, "note") || undefined,
    }, user.id);
  } catch (e) {
    fail(back, e);
  }
  revalidatePath("/admin", "layout");
  redirect(`/admin/invoices?id=${inv.id}&ok=${encodeURIComponent(`Revision ${inv.revision} issued`)}`);
}
