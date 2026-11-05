import type { Metadata } from "next";
import { addMonths, toDhakaDate } from "@/domain";
import { plain, rich } from "@/lib/rich";
import { getSitePhotos } from "@/server/photos";
import { publicMonth, sweepHolds } from "@/server/queries";
import { getContent, getLang } from "@/server/site-content";
import { BookBoard } from "./board";

export async function generateMetadata(): Promise<Metadata> {
  const c = await getContent(await getLang());
  return { title: plain(c.bookSeoTitle) };
}

type SP = { month?: string; date?: string; type?: string; adults?: string; children?: string; error?: string; taken?: string };

export default async function BookPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const lang = await getLang();
  await sweepHolds();
  const today = toDhakaDate(new Date());
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date!.slice(0, 7) : today.slice(0, 7);
  const [data, c, photos] = await Promise.all([publicMonth(month), getContent(lang), getSitePhotos()]);
  const display = lang === "bn" ? "font-bnDisplay" : "font-display";
  return (
    <main className="s-wrap pb-6 pt-10 md:pt-14">
      {c.bookEyebrow && <div className="s-eyebrow">{c.bookEyebrow}</div>}
      <h1 className={`mt-3 text-[40px] font-light leading-[1.05] tracking-[-0.5px] md:mt-3.5 md:text-[64px] md:leading-[1.02] md:tracking-[-1.5px] ${display}`}>{rich(c.bookTitle)}</h1>
      {c.bookLead && <p className="mt-3 text-[17px] text-ink-2 md:mt-4">{c.bookLead}</p>}
      <BookBoard
        key={`${month}-${sp.date ?? ""}-${sp.type ?? ""}`}
        lang={lang}
        data={data}
        today={today}
        prevMonth={month > today.slice(0, 7) ? addMonths(`${month}-01`, -1).slice(0, 7) : null}
        nextMonth={addMonths(`${month}-01`, 1).slice(0, 7)}
        initial={{
          date: sp.date && sp.date.startsWith(month) ? sp.date : null,
          type: sp.type === "FULL_BOAT" ? "FULL_BOAT" : "SHARED",
          adults: Math.min(16, Math.max(1, Number(sp.adults) || 2)),
          children: Math.min(12, Math.max(0, Number(sp.children) || 0)),
        }}
        error={sp.error}
        taken={sp.taken ? sp.taken.split(",").filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)) : sp.taken === "none" ? [] : null}
        phone={c.phone}
        cabinPics={photos.cabins}
        summaryPic={photos.book}
      />
    </main>
  );
}
