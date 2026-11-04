"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/current-user";
import { prisma } from "@/server/db";
import { FOCUS, MAX_PHOTO_BYTES, PLACES, type Place, sniffImage } from "@/server/photos";
import { int, str, withParam } from "../_lib/form";

const BACK = "/admin/settings/photos";
const place = (v: string): Place => ((PLACES as readonly string[]).includes(v) ? (v as Place) : "GALLERY");
const focus = (v: string) => (v in FOCUS ? v : "center");
const refresh = () => { revalidatePath("/", "layout"); };

/** Called from the uploader once per photo (already resized in the browser). */
export async function uploadPhotoAction(form: FormData): Promise<{ ok: boolean; error?: string }> {
  const u = await requireUser("ADMIN_SETTINGS");
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "No file" };
  if (file.size > MAX_PHOTO_BYTES) return { ok: false, error: "Photo is larger than 4 MB" };
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniffImage(buf);
  if (!mime) return { ok: false, error: "Only JPG, PNG or WebP photos" };
  const p = place(str(form, "place"));
  const last = await prisma.sitePhoto.aggregate({ where: { place: p }, _max: { sort: true } });
  const photo = await prisma.sitePhoto.create({
    data: {
      place: p, alt: str(form, "alt").slice(0, 200), focus: focus(str(form, "focus")), sort: (last._max.sort ?? 0) + 1,
      mime, size: buf.length, width: int(form, "width"), height: int(form, "height"), data: buf,
    },
    select: { id: true },
  });
  await prisma.auditLog.create({ data: { entity: "SitePhoto", entityId: photo.id, action: "PHOTO_ADDED", actor: u.id } });
  refresh();
  return { ok: true };
}

export async function updatePhotoAction(form: FormData) {
  await requireUser("ADMIN_SETTINGS");
  await prisma.sitePhoto.update({ where: { id: str(form, "id") }, data: { place: place(str(form, "place")), alt: str(form, "alt").slice(0, 200), focus: focus(str(form, "focus")) } });
  refresh();
  redirect(withParam(BACK, "ok", "Photo saved"));
}

/** Swap a photo with its neighbour inside the same place. */
export async function movePhotoAction(form: FormData) {
  await requireUser("ADMIN_SETTINGS");
  const me = await prisma.sitePhoto.findUniqueOrThrow({ where: { id: str(form, "id") }, select: { id: true, place: true, sort: true } });
  const up = str(form, "dir") === "up";
  const all = await prisma.sitePhoto.findMany({ where: { place: me.place }, select: { id: true }, orderBy: [{ sort: "asc" }, { createdAt: "asc" }] });
  const i = all.findIndex((r) => r.id === me.id);
  const j = up ? i - 1 : i + 1;
  if (j >= 0 && j < all.length) {
    [all[i], all[j]] = [all[j], all[i]];
    await prisma.$transaction(all.map((r, k) => prisma.sitePhoto.update({ where: { id: r.id }, data: { sort: k + 1 } })));
  }
  refresh();
  redirect(BACK);
}

export async function deletePhotoAction(form: FormData) {
  const u = await requireUser("ADMIN_SETTINGS");
  const id = str(form, "id");
  await prisma.sitePhoto.delete({ where: { id } });
  await prisma.auditLog.create({ data: { entity: "SitePhoto", entityId: id, action: "PHOTO_REMOVED", actor: u.id } });
  refresh();
  redirect(withParam(BACK, "ok", "Photo removed from the website"));
}
