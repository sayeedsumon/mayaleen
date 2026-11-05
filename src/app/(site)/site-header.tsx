"use client";

import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { LangSwitch } from "./lang-switch";

type Props = {
  lang: "en" | "bn";
  display: string;
  name: string;
  logo: { src: string; alt: string } | null;
  links: [string, string][];
  myBooking: string;
  bookNow: string;
  menu: string;
};

/** Pages that open with a full-bleed photo get a transparent header laid over it. */
const OVERLAY = new Set(["/", "/boat"]);

export function SiteHeader({ lang, display, name, logo, links, myBooking, bookNow, menu }: Props) {
  const path = usePathname();
  const overlay = OVERLAY.has(path);
  const ink = overlay ? "text-white hover:text-white" : "text-ink hover:text-pine";

  return (
    <header className={overlay ? "absolute inset-x-0 top-0 z-20" : "border-b border-dune-line bg-mist"}>
      <div className="s-wrap flex items-center gap-6 py-4 md:gap-9 md:py-6">
        <a href="/" className={`text-[24px] no-underline md:text-[28px] ${display} ${overlay ? "text-white hover:text-white" : "text-pine hover:text-pine"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logo ? <img src={logo.src} alt={name} className="h-9 w-auto max-w-[180px] object-contain md:h-11" /> : name}
        </a>
        <nav aria-label="Main" className="hidden flex-1 flex-wrap gap-7 text-sm font-medium lg:flex">
          {links.map(([href, label]) => (
            <a key={href} href={href} aria-current={path === href ? "page" : undefined}
              className={`no-underline ${ink} ${path === href ? "underline decoration-1 underline-offset-[6px]" : ""}`}>{label}</a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 md:gap-4">
          <Suspense><LangSwitch lang={lang} light={overlay} /></Suspense>
          <a href="/booking" className={`hidden text-sm font-medium no-underline sm:inline ${ink}`}>{myBooking}</a>
          <a href="/book" className={`hidden h-11 px-[22px] text-sm sm:inline-flex ${overlay ? "s-btn-light" : "s-btn"}`}>{bookNow}</a>
          <details className="relative lg:hidden">
            <summary aria-label={menu} className={`flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-full [&::-webkit-details-marker]:hidden ${overlay ? "bg-white text-pine" : "bg-pine text-white"}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10" /></svg>
            </summary>
            <nav aria-label="Menu" className="absolute right-0 top-[52px] z-30 flex w-[min(80vw,280px)] flex-col rounded-2xl bg-white p-2 text-[15px] font-medium shadow-[0_18px_44px_rgba(8,30,28,0.18)]">
              {links.map(([href, label]) => <a key={href} href={href} className="rounded-xl px-4 py-3 text-ink no-underline hover:bg-dune hover:text-ink">{label}</a>)}
              <a href="/booking" className="rounded-xl px-4 py-3 text-ink no-underline hover:bg-dune hover:text-ink">{myBooking}</a>
              <a href="/book" className="s-btn mt-1">{bookNow}</a>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
