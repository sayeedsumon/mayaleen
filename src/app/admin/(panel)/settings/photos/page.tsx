import { Banner, Card, Empty } from "@/components/ui";
import { requireUser } from "@/server/auth/current-user";
import { prisma } from "@/server/db";
import { FOCUS, type Focus, GALLERY_MAX, PLACE_LABEL, PLACES } from "@/server/photos";

const FOCUS_LABEL: [Focus, string][] = [["top", "Keep the top"], ["center", "Keep the middle"], ["bottom", "Keep the bottom"]];
import { deletePhotoAction, movePhotoAction, updatePhotoAction } from "../../../_actions/photos";
import { Uploader } from "./uploader";

export default async function PhotosPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireUser("ADMIN_SETTINGS");
  const sp = await searchParams;
  const rows = await prisma.sitePhoto.findMany({
    select: { id: true, place: true, alt: true, focus: true, width: true, height: true, size: true },
    orderBy: [{ sort: "asc" }, { createdAt: "asc" }],
  });
  const places = PLACES.map((p) => [p, PLACE_LABEL[p]] as [string, string]);

  return (
    <div className="flex flex-col gap-4">
      <Banner tone="ok">{sp.ok}</Banner>
      <Banner>{sp.error}</Banner>
      <Card title="Add photos to the website">
        <Uploader places={places} />
        <p className="mt-3 text-xs text-ink-muted">
          Only upload photos you have the right to use, and that the guests shown are happy to appear on the website.
          Until you add photos to a place, the website uses the built-in ones.
        </p>
      </Card>

      {PLACES.map((p) => {
        const list = rows.filter((r) => r.place === p);
        const note = p === "HERO" || p === "BOAT" ? "The first photo is shown." : p === "GALLERY" ? `The first ${GALLERY_MAX} are shown; the first one is large.` : "Cabin cards use these in turn.";
        return (
          <Card key={p} title={`${PLACE_LABEL[p]} · ${list.length}`}>
            <p className="-mt-1 mb-3 text-xs text-ink-muted">{note}</p>
            {list.length === 0 ? <Empty>No photos here yet — the built-in ones are used.</Empty> : (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {list.map((r, i) => (
                  <li key={r.id} className="overflow-hidden rounded-xl border border-hair">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/img/${r.id}`} alt={r.alt} loading="lazy" className="h-44 w-full bg-sand object-cover" style={{ objectPosition: FOCUS[r.focus as Focus] ?? "center" }} />
                    <div className="flex flex-col gap-2 p-3">
                      <form action={updatePhotoAction} className="flex flex-col gap-2">
                        <input type="hidden" name="id" value={r.id} />
                        <input name="alt" defaultValue={r.alt} maxLength={200} placeholder="Short description" aria-label="Short description" className="input h-9 text-sm" />
                        <select name="place" defaultValue={r.place} aria-label="Where on the website" className="input h-9 text-sm">
                          {places.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                        <div className="flex gap-2">
                          <select name="focus" defaultValue={r.focus} aria-label="Which part to show when cropped" className="input h-9 min-w-0 flex-1 text-sm">
                            {FOCUS_LABEL.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                          <button className="btn-ghost h-9 px-3 text-sm">Save</button>
                        </div>
                      </form>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
                        <span className="mr-auto whitespace-nowrap">{r.width}×{r.height} · {Math.round(r.size / 1024)} KB</span>
                        <form action={movePhotoAction}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="dir" value="up" />
                          <button disabled={i === 0} aria-label="Move earlier" className="btn-ghost h-8 px-2.5 text-sm disabled:opacity-40">↑</button></form>
                        <form action={movePhotoAction}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="dir" value="down" />
                          <button disabled={i === list.length - 1} aria-label="Move later" className="btn-ghost h-8 px-2.5 text-sm disabled:opacity-40">↓</button></form>
                        <form action={deletePhotoAction}><input type="hidden" name="id" value={r.id} />
                          <button className="btn-danger h-8 px-2.5 text-sm">Remove</button></form>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}
