import { redirect } from "next/navigation";
import { RuleError } from "@/domain";
import { SlotTakenError } from "@/server/booking-service";

export const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
export const int = (f: FormData, k: string) => Number.parseInt(str(f, k).replace(/[^0-9-]/g, "") || "0", 10) || 0;
export const bool = (f: FormData, k: string) => ["on", "true", "1", "yes"].includes(str(f, k));

/** Turn a rule error into a message on the page the user came from. */
export function fail(path: string, e: unknown): never {
  const msg = e instanceof SlotTakenError
    ? `Just booked by someone else. Nearest free dates: ${e.alternatives.join(", ") || "none in the next 60 days"}`
    : e instanceof RuleError ? e.message : "Something went wrong. Please try again.";
  if (!(e instanceof RuleError)) console.error(e);
  redirect(withParam(path, "error", msg));
}

export function done(path: string, msg: string): never {
  redirect(withParam(path, "ok", msg));
}

export function withParam(path: string, k: string, v: string) {
  const [base, hash] = path.split("#");
  const url = `${base}${base.includes("?") ? "&" : "?"}${k}=${encodeURIComponent(v)}`;
  return hash ? `${url}#${hash}` : url;
}

/** A datetime-local value (Asia/Dhaka wall time) to an instant. */
export function dhakaLocal(v: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return undefined;
  return new Date(Date.parse(`${v}:00Z`) - 6 * 3_600_000);
}

/** An instant to a datetime-local value in Asia/Dhaka. */
export function toDhakaLocal(d: Date | null | undefined): string {
  if (!d) return "";
  return new Date(d.getTime() + 6 * 3_600_000).toISOString().slice(0, 16);
}
