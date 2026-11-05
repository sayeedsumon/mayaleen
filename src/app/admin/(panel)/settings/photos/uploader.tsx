"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { uploadPhotoAction } from "../../../_actions/photos";

const MAX_EDGE = 2000;

/** Shrinks a photo in the browser (also drops GPS/camera data) so uploads stay small. */
async function shrink(file: File, logo: boolean): Promise<{ blob: Blob; width: number; height: number; type: string }> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  // Logos keep transparency (PNG) and stay small; photos become JPEG.
  const type = logo ? "image/png" : "image/jpeg";
  const scale = Math.min(1, (logo ? 800 : MAX_EDGE) / Math.max(bmp.width, bmp.height));
  const width = Math.round(bmp.width * scale), height = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, width, height);
  bmp.close();
  const blob = await new Promise<Blob>((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error("encode"))), type, 0.82));
  return { blob, width, height, type };
}

export function Uploader({ places }: { places: [string, string][] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [errors, setErrors] = useState<string[]>([]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const files = (f.getAll("files") as File[]).filter((x) => x.size > 0);
    if (!files.length) return;
    setBusy(true); setErrors([]);
    const errs: string[] = [];
    for (let i = 0; i < files.length; i++) {
      setStatus(`Uploading ${i + 1} of ${files.length}…`);
      try {
        const { blob, width, height, type } = await shrink(files[i], f.get("place") === "LOGO");
        const fd = new FormData();
        fd.set("file", new File([blob], type === "image/png" ? "logo.png" : "photo.jpg", { type }));
        fd.set("place", String(f.get("place")));
        fd.set("alt", String(f.get("alt") ?? ""));
        fd.set("focus", String(f.get("focus") ?? "center"));
        fd.set("width", String(width)); fd.set("height", String(height));
        const r = await uploadPhotoAction(fd);
        if (!r.ok) errs.push(`${files[i].name}: ${r.error}`);
      } catch {
        errs.push(`${files[i].name}: could not read this photo`);
      }
    }
    setErrors(errs);
    setStatus(`${files.length - errs.length} of ${files.length} added.`);
    setBusy(false);
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-end lg:grid-cols-[1fr_1fr_1fr_auto]">
      <label className="label sm:col-span-2 lg:col-span-4">Photos
        <input type="file" name="files" multiple required accept="image/jpeg,image/png,image/webp,image/heic" className="mt-1 text-sm" disabled={busy} />
        <span className="text-xs font-normal text-ink-muted">Pick several at once. They are shrunk before upload, and location data is removed.</span>
      </label>
      <label className="label">Where on the website
        <select name="place" className="input" defaultValue="GALLERY" disabled={busy}>
          {places.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label className="label">Short description <span className="font-normal text-ink-muted">(optional)</span>
        <input name="alt" maxLength={200} placeholder="e.g. Sunset from the top deck" className="input" disabled={busy} />
      </label>
      <label className="label">When cropped, keep
        <select name="focus" className="input" defaultValue="center" disabled={busy}>
          <option value="top">the top</option><option value="center">the middle</option><option value="bottom">the bottom</option>
        </select>
      </label>
      <button className="btn" disabled={busy}>{busy ? "Uploading…" : "Upload"}</button>
      {status && <p role="status" className="text-sm text-ink-2 sm:col-span-2 lg:col-span-4">{status}</p>}
      {errors.length > 0 && <ul className="text-sm text-rose-700 sm:col-span-2 lg:col-span-4">{errors.map((x) => <li key={x}>{x}</li>)}</ul>}
    </form>
  );
}
