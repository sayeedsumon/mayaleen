import { addMonths, toDhakaDate } from "@/domain";
import { DICT } from "@/lib/i18n";
import { publicMonth, sweepHolds } from "@/server/queries";
import { getContent, getLang } from "@/server/site-content";
import { BookBoard } from "./board";

export const metadata = { title: "Check dates and book · Mayaleen" };

type SP = { month?: string; date?: string; type?: string; adults?: string; children?: string; error?: string; taken?: string };

export default async function BookPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const lang = await getLang();
  await sweepHolds();
  const today = toDhakaDate(new Date());
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date!.slice(0, 7) : today.slice(0, 7);
  const [data, c] = await Promise.all([publicMonth(month), getContent(lang)]);
  const t = DICT[lang];
  const display = lang === "bn" ? "font-bnDisplay" : "font-display";
  return (
    <main className="mx-auto max-w-[1200px] px-4 pb-16 pt-8 md:px-8 md:pt-9">
      <h1 className={`text-[34px] font-medium md:text-[42px] ${display}`}>{t.book.title}</h1>
      <p className="mt-2 text-base text-ink-2">{t.book.lead}</p>
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
      />
    </main>
  );
}
