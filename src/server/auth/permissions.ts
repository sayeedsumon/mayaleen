import type { Role } from "@prisma/client";

/** PRD §4 role matrix. */
export type Capability =
  | "VIEW_OPERATIONS" // calendar, manifest, check-in/out, NID capture
  | "CREATE_BOOKING"
  | "MANAGE_BOOKINGS" // approve/reject, invoice, verify payment, cancel/refund
  | "ADMIN_SETTINGS"; // pricing, holidays, cabins, bank, staff, reports

const MATRIX: Record<Role, Capability[]> = {
  FRONT_DESK: ["VIEW_OPERATIONS", "CREATE_BOOKING"],
  MANAGER: ["VIEW_OPERATIONS", "CREATE_BOOKING", "MANAGE_BOOKINGS"],
  ADMIN: ["VIEW_OPERATIONS", "CREATE_BOOKING", "MANAGE_BOOKINGS", "ADMIN_SETTINGS"],
};

export const can = (role: Role, cap: Capability) => MATRIX[role].includes(cap);
