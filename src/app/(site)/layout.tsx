import type { ReactNode } from "react";
import { Suspense } from "react";
import { Icon } from "@/components/ui";
import { DICT } from "@/lib/i18n";
import { getContent, getLang } from "@/server/site-content";
import { LangSwitch } from "./lang-switch";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const lang = await getLang();
  const t = DICT[lang];
  const c = await getContent(lang);
  const wa = c.whatsapp.replace(/[^0-9]/g, "");
  const font = lang === "bn" ? "font-bn" : "font-sans";
  return (
    <div className={`min-h-screen bg-ground text-ink ${font}`}>
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-8 gap-y-3 px-4 py-3.5 md:px-8">
          <a href="/" className="flex items-center gap-2.5 text-ink no-underline hover:text-ink">
            <span className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] bg-lake text-white"><Icon name="boat" size={22} /></span>
            <span className={`text-[22px] font-semibold ${lang === "bn" ? "font-bnDisplay" : "font-display"}`}>{lang === "bn" ? "মায়ালীন" : "Mayaleen"}</span>
          </a>
          <nav aria-label="Main" className="order-3 flex w-full flex-wrap gap-x-6 gap-y-2 text-[15px] font-medium md:order-none md:w-auto md:flex-1">
            <a href="/boat" className="text-ink no-underline hover:text-lake">{t.nav.boat}</a>
            <a href="/boat#packages" className="text-ink no-underline hover:text-lake">{t.nav.packages}</a>
            <a href="/boat#itinerary" className="text-ink no-underline hover:text-lake">{t.nav.itinerary}</a>
            <a href="/#faq" className="text-ink no-underline hover:text-lake">{t.nav.faq}</a>
            <a href="/#reach" className="hidden text-ink no-underline hover:text-lake sm:inline">{t.nav.reach}</a>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <Suspense><LangSwitch lang={lang} /></Suspense>
            <a href="/booking" className="hidden text-sm font-semibold no-underline sm:inline">{t.nav.myBooking}</a>
            <a href="/book" className="btn h-[42px]">{t.nav.bookNow}</a>
          </div>
        </div>
      </header>

      <div className="pb-24 md:pb-0">{children}</div>

      <footer className="mt-24 bg-lake-deep py-12 text-[#D4E6E2]">
        <div className="mx-auto flex max-w-[1200px] flex-wrap justify-between gap-8 px-4 text-sm md:px-8">
          <div className="min-w-[260px] flex-1">
            <div className={`text-[22px] text-white ${lang === "bn" ? "font-bnDisplay" : "font-display"}`}>{lang === "bn" ? "মায়ালীন" : "Mayaleen"}</div>
            <p className="mt-2 leading-[22px]">{t.footer.tagline}</p>
            {c.phone && <p className="mt-2">{t.nav.call}: <a href={`tel:${c.phone}`} className="text-white">{c.phone}</a></p>}
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-5">
            <a href="/boat" className="text-[#D4E6E2]">{t.nav.boat}</a>
            <a href="/book" className="text-[#D4E6E2]">{t.nav.bookNow}</a>
            <a href="/booking" className="text-[#D4E6E2]">{t.nav.myBooking}</a>
            <a href="/terms" className="text-[#D4E6E2]">{t.footer.terms}</a>
            {c.facebook && <a href={c.facebook} className="text-[#D4E6E2]">Facebook</a>}
          </nav>
        </div>
      </footer>

      {wa && (
        <a href={`https://wa.me/${wa}`} aria-label="WhatsApp" className="fixed bottom-6 right-6 hidden h-14 w-14 items-center justify-center rounded-full bg-lake text-white shadow-lg md:flex">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z" /><path d="M9 9.5c.5 2 2 3.5 4 4l1-1 2 1v1.5c-3.5.5-8-4-7.5-7.5H10l1 2z" /></svg>
        </a>
      )}
      <div className="fixed inset-x-0 bottom-0 z-10 flex gap-2.5 border-t border-line bg-white px-4 py-3 md:hidden">
        {c.phone && <a href={`tel:${c.phone}`} aria-label={t.nav.call} className="flex h-[50px] w-[50px] items-center justify-center rounded-xl border border-field text-ink"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg></a>}
        {wa && <a href={`https://wa.me/${wa}`} aria-label="WhatsApp" className="flex h-[50px] w-[50px] items-center justify-center rounded-xl border border-field text-ink"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z" /></svg></a>}
        <a href="/book" className="btn h-[50px] flex-1 text-base">{t.nav.bookNow}</a>
      </div>
    </div>
  );
}
