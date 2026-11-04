import type { ReactNode } from "react";
import { DICT, money, type Lang } from "@/lib/i18n";
import { loadPricingConfig } from "@/server/config";
import { prisma } from "@/server/db";
import { getContent, getLang } from "@/server/site-content";
import { MobileBar } from "./mobile-bar";
import { SiteHeader } from "./site-header";

export const dynamic = "force-dynamic";

const CHROME: Record<Lang, { menu: string; gallery: string; visit: string; boarding: string; talk: string; explore: string; pay: string; payText: string; perGuest: string; from: string }> = {
  en: {
    menu: "Menu", gallery: "Gallery", visit: "Visit", boarding: "Boarding at {place}", talk: "Talk to us", explore: "Explore",
    pay: "Pay safely", payText: "Bank transfer only, after we confirm. Pay in full or a 50% advance.", perGuest: "/ guest", from: "from",
  },
  bn: {
    menu: "মেনু", gallery: "ছবি", visit: "ঠিকানা", boarding: "{place} থেকে যাত্রা", talk: "যোগাযোগ", explore: "দেখুন",
    pay: "নিরাপদ পেমেন্ট", payText: "শুধু ব্যাংক ট্রান্সফার, আমরা নিশ্চিত করার পর। পুরো টাকা বা ৫০% অগ্রিম।", perGuest: "/ জন", from: "শুরু",
  },
};

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const lang = await getLang();
  const t = DICT[lang];
  const k = CHROME[lang];
  const [c, cfg] = await Promise.all([getContent(lang), loadPricingConfig(prisma)]);
  const wa = c.whatsapp.replace(/[^0-9]/g, "");
  const font = lang === "bn" ? "font-bn" : "font-sans";
  const display = lang === "bn" ? "font-bnDisplay" : "font-display";
  const name = lang === "bn" ? "মায়ালীন" : "Mayaleen";
  const links: [string, string][] = [
    ["/boat", t.nav.boat], ["/boat#packages", t.nav.packages], ["/boat#itinerary", t.nav.itinerary],
    ["/#gallery", k.gallery], ["/#reach", t.nav.reach],
  ];
  const footHead = "text-xs font-semibold uppercase tracking-[2px] text-gold";

  return (
    <div className={`relative min-h-screen bg-mist text-ink ${font}`}>
      <SiteHeader lang={lang} display={display} name={name} links={links} myBooking={t.nav.myBooking} bookNow={t.nav.bookNow} menu={k.menu} />

      <div className="pb-24 md:pb-0">{children}</div>

      <footer className="mt-24 bg-pine-night pb-28 text-white/80 md:mt-32 md:pb-0">
        <div className="s-wrap pb-10 pt-14 md:pt-20">
          <div className={`text-[64px] font-light leading-[0.9] tracking-[-2px] text-white md:text-[120px] md:tracking-[-3px] ${display}`}>{name}</div>
          <div className="mt-10 grid grid-cols-1 gap-8 text-[15px] leading-[26px] sm:grid-cols-2 md:mt-14 lg:grid-cols-4">
            <div><div className={footHead}>{k.visit}</div><p className="mt-3">{t.footer.tagline}<br />{k.boarding.replace("{place}", c.meetingPoint)}</p></div>
            {(c.phone || wa || c.facebook) && <div>
              <div className={footHead}>{k.talk}</div>
              <div className="mt-3 flex flex-col">
                {c.phone && <a href={`tel:${c.phone}`} className="text-white no-underline hover:text-gold">{c.phone}</a>}
                {wa && <a href={`https://wa.me/${wa}`} className="text-white no-underline hover:text-gold">WhatsApp</a>}
                {c.facebook && <a href={c.facebook} className="text-white no-underline hover:text-gold">Facebook</a>}
              </div>
            </div>}
            <nav aria-label="Footer">
              <div className={footHead}>{k.explore}</div>
              <div className="mt-3 flex flex-col">
                <a href="/boat" className="text-white no-underline hover:text-gold">{t.nav.boat}</a>
                <a href="/book" className="text-white no-underline hover:text-gold">{t.nav.bookNow}</a>
                <a href="/booking" className="text-white no-underline hover:text-gold">{t.nav.myBooking}</a>
                <a href="/terms" className="text-white no-underline hover:text-gold">{t.footer.terms}</a>
              </div>
            </nav>
            <div><div className={footHead}>{k.pay}</div><p className="mt-3">{k.payText}</p></div>
          </div>
          <div className="mt-14 flex flex-wrap justify-between gap-4 border-t border-white/15 pt-6 text-[13px] text-white/70">
            <span>© {new Date().getFullYear()} Mayaleen</span><span>English · বাংলা</span>
          </div>
        </div>
      </footer>

      {wa && (
        <a href={`https://wa.me/${wa}`} aria-label="WhatsApp" className="fixed bottom-6 right-6 z-10 hidden h-14 w-14 items-center justify-center rounded-full bg-pine text-white shadow-lg hover:bg-pine-2 hover:text-white md:flex">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z" /><path d="M9 9.5c.5 2 2 3.5 4 4l1-1 2 1v1.5c-3.5.5-8-4-7.5-7.5H10l1 2z" /></svg>
        </a>
      )}
      <MobileBar from={k.from} price={money(cfg.rates.SHARED.SUN_WED, lang)} per={k.perGuest} bookNow={t.nav.bookNow}
        call={c.phone ? { href: `tel:${c.phone}`, label: t.nav.call } : null} display={display} />
    </div>
  );
}
