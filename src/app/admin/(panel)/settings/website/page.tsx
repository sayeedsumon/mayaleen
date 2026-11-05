import Link from "next/link";
import { Banner, Card } from "@/components/ui";
import { requireUser } from "@/server/auth/current-user";
import { prisma } from "@/server/db";
import { PLACE_LABEL, type Place } from "@/server/photos";
import { FIELDS, SECTIONS, editorRows, type FieldDef } from "@/server/site-content";
import { resetWebsiteSectionAction, websiteContentAction } from "../../../_actions/settings";
import { ListEditor } from "./list-editor";

const PREVIEW: Record<string, string> = {
  "Whole website": "/", "Home page": "/", "Boat page": "/boat",
};

export default async function WebsiteContent({ searchParams }: { searchParams: Promise<{ s?: string; ok?: string; error?: string }> }) {
  await requireUser("ADMIN_SETTINGS");
  const sp = await searchParams;
  const sec = SECTIONS.find((x) => x.id === sp.s) ?? SECTIONS[0];
  const [rows, photos] = await Promise.all([
    prisma.siteContent.findMany({ where: { key: { in: sec.keys } } }),
    sec.photos?.length
      ? prisma.sitePhoto.findMany({ where: { place: { in: sec.photos } }, select: { id: true, place: true, alt: true }, orderBy: [{ sort: "asc" }, { createdAt: "asc" }] })
      : Promise.resolve([]),
  ]);
  const by = new Map(rows.map((r) => [r.key, r]));
  const groups = [...new Set(SECTIONS.map((x) => x.group))];
  const preview = sec.id === "terms" ? "/terms" : sec.id === "booking" ? "/book" : PREVIEW[sec.group] ?? "/";

  const field = (key: string, d: FieldDef) => {
    const r = by.get(key);
    if (d.type === "toggle") {
      const on = r ? r.en === "1" : d.on;
      return (
        <label key={key} className="flex items-center gap-2.5 rounded-xl border border-line bg-lake-faint px-4 py-3 text-sm font-semibold text-ink">
          <input type="checkbox" name={`${key}_on`} defaultChecked={on} className="h-[18px] w-[18px] accent-lake" />{d.label}
        </label>
      );
    }
    if (d.type === "list") {
      const v = editorRows(d, r);
      return <ListEditor key={key} name={key} label={d.label} help={d.help} cols={d.cols} en={v.en} bn={v.bn} />;
    }
    const Tag = d.long ? "textarea" : "input";
    const cls = `input ${d.long ? "min-h-[88px] py-2.5" : ""}`;
    return (
      <div key={key} className="flex flex-col gap-1.5">
        <div className="text-sm font-semibold text-ink">{d.label}</div>
        {d.help && <div className="-mt-1 text-xs text-ink-muted">{d.help}</div>}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="label">English<Tag name={`${key}_en`} defaultValue={r ? r.en : d.en} className={cls} /></label>
          <label className="label">বাংলা<Tag name={`${key}_bn`} defaultValue={r ? r.bn : d.bn} lang="bn" placeholder={r ? r.en : d.en} className={`${cls} font-bn`} /></label>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <Banner tone="ok">{sp.ok}</Banner>
      <Banner>{sp.error}</Banner>
      <p className="text-sm text-ink-2">
        Every text on the public website, in English and Bangla. Empty Bangla shows the English text. Prices come from <Link href="/admin/settings/rates">Rates</Link>,
        cabin names and descriptions from <Link href="/admin/settings/cabins">Cabins</Link>, bank details from <Link href="/admin/settings/bank">Bank accounts</Link>,
        pictures from <Link href="/admin/settings/photos">Website photos</Link>.
      </p>

      <nav aria-label="Website sections" className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-3">
        {groups.map((g) => (
          <div key={g} className="flex flex-wrap items-center gap-1.5">
            <span className="w-[110px] flex-none text-xs font-semibold text-ink-muted">{g}</span>
            {SECTIONS.filter((x) => x.group === g).map((x) => (
              <Link key={x.id} href={`?s=${x.id}`} aria-current={x.id === sec.id ? "page" : undefined}
                className={`rounded-full border px-3 py-1.5 text-[13px] no-underline ${x.id === sec.id ? "border-ink bg-ink text-white hover:text-white" : "border-field bg-white text-ink hover:text-ink"}`}>{x.title}</Link>
            ))}
          </div>
        ))}
      </nav>

      <Card title={`${sec.group} › ${sec.title}`}>
        {sec.photos && sec.photos.length > 0 && (
          <div className="mb-5 flex flex-col gap-2 rounded-xl bg-sand p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold">Pictures in this section</span>
              <Link href={`/admin/settings/photos#place-${sec.photos[0]}`} className="text-sm font-semibold">Change pictures →</Link>
            </div>
            {sec.photos.map((p) => {
              const list = photos.filter((ph) => ph.place === p);
              return (
                <div key={p} className="flex flex-wrap items-center gap-2">
                  <span className="w-[220px] text-xs text-ink-2">{PLACE_LABEL[p as Place]}</span>
                  {list.length === 0 ? <span className="text-xs text-ink-muted">{p === "LOGO" ? "None — the website name is shown" : "Built-in photo in use"}</span>
                    // eslint-disable-next-line @next/next/no-img-element
                    : list.slice(0, 6).map((ph) => <img key={ph.id} src={`/img/${ph.id}`} alt={ph.alt} className="h-12 w-16 rounded-md bg-white object-cover" />)}
                </div>
              );
            })}
          </div>
        )}

        <form action={websiteContentAction} className="flex flex-col gap-5">
          <input type="hidden" name="section" value={sec.id} />
          {sec.keys.map((k) => field(k, FIELDS[k] as FieldDef))}
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <button className="btn">Save “{sec.title}”</button>
            <a href={preview} target="_blank" rel="noreferrer" className="btn-ghost">View on the website ↗</a>
          </div>
        </form>
        <form action={resetWebsiteSectionAction} className="mt-3">
          <input type="hidden" name="section" value={sec.id} />
          <button className="text-xs font-semibold text-rose-ink underline">Restore the original wording for this section</button>
        </form>
      </Card>
    </div>
  );
}
