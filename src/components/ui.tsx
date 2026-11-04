import type { ReactNode } from "react";

// ---------- Status chips (one vocabulary everywhere) ----------

export const STATUS: Record<string, { label: string; chip: string; held: boolean }> = {
  PENDING_APPROVAL: { label: "Needs approval", chip: "bg-amber-soft text-amber-ink", held: true },
  AWAITING_PAYMENT: { label: "Awaiting payment", chip: "bg-amber-soft text-amber-ink", held: true },
  PAYMENT_SUBMITTED: { label: "Proof to verify", chip: "bg-sky-soft text-sky-ink", held: true },
  CONFIRMED_BALANCE_DUE: { label: "Balance due", chip: "bg-lake-soft text-lake-dark", held: false },
  CONFIRMED_PAID: { label: "Paid", chip: "bg-leaf-soft text-leaf-ink", held: false },
  CHECKED_IN: { label: "On board", chip: "bg-lake-soft text-lake-dark", held: false },
  COMPLETED: { label: "Completed", chip: "bg-sand-2 text-ink-2", held: false },
  REJECTED: { label: "Rejected", chip: "bg-rose-soft text-rose-ink", held: false },
  EXPIRED: { label: "Expired", chip: "bg-sand-2 text-ink-muted", held: false },
  CANCELLED: { label: "Cancelled", chip: "bg-rose-soft text-rose-ink", held: false },
  NO_SHOW: { label: "No-show", chip: "bg-rose-soft text-rose-ink", held: false },
};

export function StatusChip({ status, className = "" }: { status: string; className?: string }) {
  const s = STATUS[status] ?? { label: status, chip: "bg-sand-2 text-ink-2" };
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${s.chip} ${className}`}>{s.label}</span>;
}

export function Chip({ tone = "sand", children }: { tone?: "sand" | "lake" | "amber" | "sky" | "leaf" | "rose"; children: ReactNode }) {
  const c = {
    sand: "bg-sand-2 text-ink-2", lake: "bg-lake-soft text-lake-dark", amber: "bg-amber-soft text-amber-ink",
    sky: "bg-sky-soft text-sky-ink", leaf: "bg-leaf-soft text-leaf-ink", rose: "bg-rose-soft text-rose-ink",
  }[tone];
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${c}`}>{children}</span>;
}

// ---------- Layout ----------

export function PageHeader({ eyebrow, title, children }: { eyebrow?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end gap-3">
      <div className="min-w-[260px] flex-1">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="h1 mt-0.5">{title}</h1>
      </div>
      {children}
    </header>
  );
}

export function Card({ title, action, children, className = "", pad = true }: {
  title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; pad?: boolean;
}) {
  return (
    <section className={`card ${pad ? "p-5" : ""} ${className}`}>
      {(title || action) && (
        <div className={`mb-3 flex flex-wrap items-baseline justify-between gap-2 ${pad ? "" : "px-5 pt-4"}`}>
          {title && <h2 className="text-[17px] font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, note, tone = "plain", href }: {
  label: string; value: ReactNode; note?: ReactNode; tone?: "plain" | "lake"; href?: string;
}) {
  const cls = tone === "lake"
    ? "bg-lake text-white border-lake"
    : "bg-white text-ink border-line";
  const body = (
    <>
      <span className={`text-[13px] font-semibold ${tone === "lake" ? "text-[#D4E6E2]" : "text-ink-muted"}`}>{label}</span>
      <span className="font-display text-[32px] font-semibold leading-none">{value}</span>
      {note && <span className={`text-xs ${tone === "lake" ? "text-[#D4E6E2]" : "text-ink-2"}`}>{note}</span>}
    </>
  );
  const c = `flex flex-col gap-1.5 rounded-2xl border px-[18px] py-4 no-underline ${cls}`;
  return href ? <a href={href} className={`${c} hover:text-inherit`}>{body}</a> : <div className={c}>{body}</div>;
}

export function Banner({ tone = "error", children }: { tone?: "error" | "info" | "ok" | "warn"; children: ReactNode }) {
  if (!children) return null;
  const c = { error: "bg-rose-soft text-rose-ink", info: "bg-sky-soft text-sky-ink", ok: "bg-lake-soft text-lake-dark", warn: "bg-amber-soft text-amber-ink" }[tone];
  return <p role={tone === "error" ? "alert" : "status"} className={`rounded-xl px-4 py-3 text-sm ${c}`}>{children}</p>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-ink-muted">{children}</p>;
}

export function Progress({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-hair" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-2 rounded-full bg-lake" style={{ width: `${pct}%` }} />
    </div>
  );
}

// ---------- Icons (stroke, inherit color) ----------

const PATHS: Record<string, ReactNode> = {
  plus: <path d="M12 5v14M5 12h14" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  timeline: <><path d="M3 6h18M3 12h18M3 18h18" /><path d="M8 4v4M14 10v4M11 16v4" /></>,
  list: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
  boarding: <><path d="M4 21V9l8-5 8 5v12" /><path d="M9 21v-6h6v6" /></>,
  invoice: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></>,
  money: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></>,
  guests: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.5 3.4-5 6.5-5s5.7 1.5 6.5 5" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .6 3.1 2.2 3.5 5" /></>,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>,
  left: <path d="M15 6l-6 6 6 6" />,
  right: <path d="M9 6l6 6-6 6" />,
  check: <path d="M5 12l5 5 9-10" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
  print: <path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z" />,
  download: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  pencil: <path d="M4 20l4-1L19 8l-3-3L5 16z" />,
  boat: <><path d="M3 15c2 0 2-1.5 4.5-1.5S10 15 12 15s2-1.5 4.5-1.5S19 15 21 15" /><path d="M3 19c2 0 2-1.5 4.5-1.5S10 19 12 19s2-1.5 4.5-1.5S19 19 21 19" /><path d="M6 11h12l-2-4H8z" /></>,
};

export function Icon({ name, size = 18, className = "" }: { name: keyof typeof PATHS | string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {PATHS[name]}
    </svg>
  );
}

export function Check({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <span className={`flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full ${ok ? "bg-leaf-soft text-leaf-ink" : "bg-amber-soft text-amber-ink"}`}>
        {ok ? <Icon name="check" size={12} /> : <span className="text-xs font-bold">!</span>}
      </span>
      <span>{children}</span>
    </div>
  );
}
