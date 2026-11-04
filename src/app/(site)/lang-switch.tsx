"use client";

import { usePathname, useSearchParams } from "next/navigation";

export function LangSwitch({ lang }: { lang: "en" | "bn" }) {
  const path = usePathname();
  const qs = useSearchParams().toString();
  const back = encodeURIComponent(qs ? `${path}?${qs}` : path);
  const item = (to: "en" | "bn", label: string) => (
    <a href={`/lang?to=${to}&back=${back}`} lang={to} aria-current={lang === to ? "true" : undefined}
      className={`px-3 py-1.5 no-underline ${lang === to ? "bg-ink text-white hover:text-white" : "text-ink hover:text-ink"}`}>{label}</a>
  );
  return (
    <div role="group" aria-label="Language" className="flex overflow-hidden rounded-full border border-field text-[13px] font-semibold">
      {item("en", "EN")}{item("bn", "বাংলা")}
    </div>
  );
}
