"use client";

import { usePathname } from "next/navigation";

type Props = { from: string; price: string; per: string; bookNow: string; call: { href: string; label: string } | null; display: string };

/** Phone-only booking bar. Hidden where the page already is the booking flow. */
export function MobileBar({ from, price, per, bookNow, call, display }: Props) {
  const path = usePathname();
  if (path.startsWith("/book")) return null;
  return (
    <div className="fixed inset-x-3 bottom-3 z-20 flex items-center gap-2.5 rounded-[18px] bg-white/95 p-2.5 shadow-[0_12px_30px_rgba(8,30,28,0.2)] backdrop-blur md:hidden">
      <div className="min-w-0 flex-1 pl-2">
        <div className="text-xs text-ink-muted">{from}</div>
        <div className={`truncate text-[22px] leading-tight text-ink ${display}`}>{price} <span className="font-sans text-xs text-ink-muted">{per}</span></div>
      </div>
      {call && (
        <a href={call.href} aria-label={call.label} className="flex h-12 w-12 items-center justify-center rounded-[14px] border border-dune-rule text-ink hover:text-ink">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg>
        </a>
      )}
      <a href="/book" className="inline-flex h-12 items-center rounded-[14px] bg-pine px-5 text-[15px] font-semibold text-white no-underline hover:bg-pine-2 hover:text-white">{bookNow}</a>
    </div>
  );
}
