import type { Metadata } from "next";
import type { ReactNode } from "react";
import { money } from "@/lib/i18n";
import { plain } from "@/lib/rich";
import { loadPricingConfig } from "@/server/config";
import { prisma } from "@/server/db";
import { getSitePhotos } from "@/server/photos";
import { getContent, getLang } from "@/server/site-content";
import { MobileBar } from "./mobile-bar";
import { SiteHeader } from "./site-header";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const c = await getContent(await getLang());
  return {
    title: plain(c.seoTitle),
    description: c.seoDescription,
    openGraph: { title: plain(c.seoTitle), description: c.seoDescription, siteName: c.siteName, type: "website" },
  };
}

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const lang = await getLang();
  const [c, cfg, photos] = await Promise.all([getContent(lang), loadPricingConfig(prisma), getSitePhotos()]);
  const wa = c.whatsapp.replace(/[^0-9]/g, "");
  const font = lang === "bn" ? "font-bn" : "font-sans";
  const display = lang === "bn" ? "font-bnDisplay" : "font-display";
  const name = c.siteName;
  const links = ([
    ["/boat", c.navBoat], ["/boat#packages", c.navPackages], ["/boat#itinerary", c.navItinerary],
    ["/#gallery", c.navGallery], ["/#reach", c.navReach],
  ] as [string, string][]).filter(([, l]) => l);
  const footHead = "text-xs font-semibold uppercase tracking-[2px] text-gold";

  return (
    <div className={`relative min-h-screen bg-mist text-ink ${font}`}>
      <SiteHeader lang={lang} display={display} name={name} logo={photos.logo} links={links} myBooking={c.navMyBooking} bookNow={c.navBookNow} menu={c.navMenu} />

      <div className="pb-24 md:pb-0">{children}</div>

      <footer className="mt-24 bg-pine-night pb-28 text-white/80 md:mt-32 md:pb-0">
        <div className="s-wrap pb-10 pt-14 md:pt-20">
          <div className={`text-[64px] font-light leading-[0.9] tracking-[-2px] text-white md:text-[120px] md:tracking-[-3px] ${display}`}>{name}</div>
          <div className="mt-10 grid grid-cols-1 gap-8 text-[15px] leading-[26px] sm:grid-cols-2 md:mt-14 lg:grid-cols-4">
            <div><div className={footHead}>{c.footerVisit}</div><p className="mt-3">{c.footerTagline}{c.footerTagline && c.footerBoarding && <br />}{plain(c.footerBoarding, { place: c.meetingPoint })}</p></div>
            {(c.phone || wa || c.facebook) && <div>
              <div className={footHead}>{c.footerTalk}</div>
              <div className="mt-3 flex flex-col">
                {c.phone && <a href={`tel:${c.phone}`} className="text-white no-underline hover:text-gold">{c.phone}</a>}
                {wa && <a href={`https://wa.me/${wa}`} className="text-white no-underline hover:text-gold">WhatsApp</a>}
                {c.facebook && <a href={c.facebook} className="text-white no-underline hover:text-gold">Facebook</a>}
              </div>
            </div>}
            <nav aria-label="Footer">
              <div className={footHead}>{c.footerExplore}</div>
              <div className="mt-3 flex flex-col">
                {c.navBoat && <a href="/boat" className="text-white no-underline hover:text-gold">{c.navBoat}</a>}
                <a href="/book" className="text-white no-underline hover:text-gold">{c.navBookNow}</a>
                <a href="/booking" className="text-white no-underline hover:text-gold">{c.navMyBooking}</a>
                <a href="/terms" className="text-white no-underline hover:text-gold">{c.footerTerms}</a>
              </div>
            </nav>
            {(c.footerPay || c.footerPayText) && <div><div className={footHead}>{c.footerPay}</div><p className="mt-3">{c.footerPayText}</p></div>}
          </div>
          <div className="mt-14 flex flex-wrap justify-between gap-4 border-t border-white/15 pt-6 text-[13px] text-white/70">
            <span>© {new Date().getFullYear()} {name}</span><span>English · বাংলা</span>
          </div>
        </div>
      </footer>

      {wa && (
        <a href={`https://wa.me/${wa}`} aria-label="WhatsApp" className="fixed bottom-6 right-6 z-10 hidden h-14 w-14 items-center justify-center rounded-full bg-pine text-white shadow-lg hover:bg-pine-2 hover:text-white md:flex">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z" /><path d="M9 9.5c.5 2 2 3.5 4 4l1-1 2 1v1.5c-3.5.5-8-4-7.5-7.5H10l1 2z" /></svg>
        </a>
      )}
      <MobileBar from={c.barFrom} price={money(cfg.rates.SHARED.SUN_WED, lang)} per={c.barPer} bookNow={c.navBookNow}
        call={c.phone ? { href: `tel:${c.phone}`, label: c.navCall } : null} display={display} />
    </div>
  );
}
