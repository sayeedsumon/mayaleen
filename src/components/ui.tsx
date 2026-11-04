import type { ReactNode } from "react";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/format";

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[status] ?? "bg-slate-100"}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg bg-white p-4 shadow-sm ${className}`}>
      {title && <h2 className="mb-2 font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

export function ErrorBanner({ message }: { message?: string }) {
  if (!message) return null;
  return <p role="alert" className="mb-3 rounded bg-red-50 p-3 text-sm text-red-700">{message}</p>;
}

export const inputCls = "w-full rounded border border-slate-300 p-2 text-sm";
export const btnCls = "rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700";
export const btnGhostCls = "rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100";
export const btnDangerCls = "rounded bg-red-700 px-3 py-2 text-sm text-white hover:bg-red-600";

export const STATUS_DOT: Record<string, string> = {
  PENDING_APPROVAL: "bg-amber-500",
  AWAITING_PAYMENT: "bg-orange-500",
  PAYMENT_SUBMITTED: "bg-blue-500",
  CONFIRMED_BALANCE_DUE: "bg-lime-500",
  CONFIRMED_PAID: "bg-green-600",
  CHECKED_IN: "bg-teal-600",
  COMPLETED: "bg-slate-500",
};
