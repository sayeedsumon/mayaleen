"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SettingsNav({ items }: { items: [string, string][] }) {
  const path = usePathname();
  return (
    <nav aria-label="Settings sections" className="flex w-full flex-row flex-wrap gap-0.5 md:w-[210px] md:flex-col">
      {items.map(([href, label]) => {
        const on = path === href;
        return (
          <Link key={href} href={href} aria-current={on ? "page" : undefined}
            className={`rounded-lg px-3 py-2.5 text-sm no-underline ${on ? "border border-line bg-white font-semibold text-ink hover:text-ink" : "text-ink-2 hover:bg-sand-3 hover:text-ink"}`}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
