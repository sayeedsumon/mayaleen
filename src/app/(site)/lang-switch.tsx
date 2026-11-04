"use client";

import { usePathname, useSearchParams } from "next/navigation";

export function LangSwitch({ lang, light = false }: { lang: "en" | "bn"; light?: boolean }) {
  const path = usePathname();
  const qs = useSearchParams().toString();
  const back = encodeURIComponent(qs ? `${path}?${qs}` : path);
  const item = (to: "en" | "bn", label: string) => {
    const on = lang === to;
    const tone = on
      ? light ? "bg-white text-pine hover:text-pine" : "bg-pine text-white hover:text-white"
      : light ? "text-white hover:text-white" : "text-ink hover:text-ink";
    return (
      <a href={`/lang?to=${to}&back=${back}`} lang={to} aria-current={on ? "true" : undefined}
        className={`rounded-full px-3 py-1.5 no-underline ${tone}`}>{label}</a>
    );
  };
  return (
    <div role="group" aria-label="Language" className={`flex rounded-full border p-[3px] text-xs font-semibold ${light ? "border-white/45" : "border-dune-rule"}`}>
      {item("en", "EN")}{item("bn", "বাংলা")}
    </div>
  );
}
