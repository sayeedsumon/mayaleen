"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui";

interface Item { href: string; label: string; icon: string; badge?: number; exact?: boolean; tone?: "sky" }

export function NavLinks({ items }: { items: Item[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-row flex-wrap gap-0.5 md:flex-col md:flex-nowrap">
      {items.map((it) => {
        const on = it.exact ? path === it.href : path === it.href || path.startsWith(`${it.href}/`);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={on ? "page" : undefined}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium no-underline ${
              on ? "bg-lake-soft text-lake-dark hover:text-lake-dark" : "text-ink-2 hover:bg-sand-3 hover:text-ink"
            }`}
          >
            <Icon name={it.icon} />
            <span className="flex-1">{it.label}</span>
            {!!it.badge && (
              <span className={`flex h-[22px] min-w-[22px] items-center justify-center rounded-full px-1.5 text-xs font-semibold text-white ${it.tone === "sky" ? "bg-sky" : "bg-amber"}`}>
                {it.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
