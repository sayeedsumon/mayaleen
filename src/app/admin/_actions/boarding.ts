"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/current-user";
import * as wf from "@/server/workflow-service";
import { fail, int, str, withParam } from "../_lib/form";

export async function checkInAction(bookingId: string, form: FormData) {
  const user = await requireUser("VIEW_OPERATIONS");
  const back = str(form, "back") || "/admin/boarding";
  try {
    const n = int(form, "count");
    const adults = Array.from({ length: n }, (_, k) => ({
      name: str(form, `name${k}`), nidOrPassport: str(form, `nid${k}`), cabin: str(form, `cabin${k}`),
    }));
    await wf.checkIn(bookingId, user.id, adults, new Date(), { emergencyContact: str(form, "emergency") });
  } catch (e) {
    fail(withParam(back, "booking", bookingId), e);
  }
  revalidatePath("/admin", "layout");
  redirect(withParam(back, "ok", "Checked in. The manifest is updated."));
}

export async function checkOutAction(bookingId: string, form: FormData) {
  const user = await requireUser("VIEW_OPERATIONS");
  const back = str(form, "back") || "/admin/boarding";
  try {
    await wf.checkOut(bookingId, user.id, str(form, "notes"));
  } catch (e) {
    fail(back, e);
  }
  revalidatePath("/admin", "layout");
  redirect(withParam(back, "ok", "Checked out. Trip completed."));
}

export async function noShowBoardingAction(bookingId: string, form: FormData) {
  const user = await requireUser("MANAGE_BOOKINGS");
  const back = str(form, "back") || "/admin/boarding";
  try {
    await wf.markNoShow(bookingId, user.id, "Guests did not arrive");
  } catch (e) {
    fail(back, e);
  }
  revalidatePath("/admin", "layout");
  redirect(withParam(back, "ok", "Marked as no-show. Cabins released."));
}
