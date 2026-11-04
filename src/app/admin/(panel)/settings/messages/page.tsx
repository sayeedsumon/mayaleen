import Link from "next/link";
import type { MessageStatus } from "@prisma/client";
import { Banner, Card, Chip, Empty } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import { requireUser } from "@/server/auth/current-user";
import { prisma } from "@/server/db";
import { resendMessageAction } from "../../../_actions/settings";

const TONE: Record<MessageStatus, "leaf" | "amber" | "rose" | "sky"> = { SENT: "leaf", LOGGED: "amber", FAILED: "rose", QUEUED: "sky" };
const LABEL: Record<MessageStatus, string> = { SENT: "Sent", LOGGED: "Not sent · no gateway", FAILED: "Failed", QUEUED: "Queued" };

export default async function Messages({ searchParams }: { searchParams: Promise<{ s?: string; ok?: string; error?: string }> }) {
  await requireUser("MANAGE_BOOKINGS");
  const sp = await searchParams;
  const status = (["SENT", "LOGGED", "FAILED", "QUEUED"].includes(sp.s ?? "") ? sp.s : undefined) as MessageStatus | undefined;
  const [rows, counts] = await Promise.all([
    prisma.message.findMany({ where: status ? { status } : {}, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.message.groupBy({ by: ["status"], _count: true }),
  ]);
  const count = (k: string) => counts.find((c) => c.status === k)?._count ?? 0;
  const smsOn = !!process.env.SMS_URL_TEMPLATE;
  const mailOn = !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
  return (
    <div className="flex flex-col gap-5">
      <Banner tone="ok">{sp.ok}</Banner>
      <Banner>{sp.error}</Banner>
      <Card title="SMS and email gateways">
        <div className="flex flex-col gap-2 text-sm">
          <div>SMS: {smsOn ? <Chip tone="leaf">Connected</Chip> : <Chip tone="amber">Not set up</Chip>} <span className="text-ink-muted">Set <code>SMS_URL_TEMPLATE</code> in Vercel to your SMS gateway&apos;s send URL with {"{to}"} and {"{text}"}.</span></div>
          <div>Email: {mailOn ? <Chip tone="leaf">Connected</Chip> : <Chip tone="amber">Not set up</Chip>} <span className="text-ink-muted">Set <code>RESEND_API_KEY</code> and <code>EMAIL_FROM</code>.</span></div>
          {!smsOn && <p className="text-ink-2">Until then every message is kept here so staff can send it from a phone.</p>}
        </div>
      </Card>
      <div className="flex flex-wrap gap-1.5">
        {([[undefined, "All"], ["LOGGED", "Not sent"], ["FAILED", "Failed"], ["SENT", "Sent"]] as const).map(([k, l]) => (
          <Link key={l} href={k ? `?s=${k}` : "?"} className={`flex h-9 items-center rounded-full border px-3.5 text-sm no-underline ${status === k ? "border-ink bg-ink text-white hover:text-white" : "border-field bg-white text-ink hover:text-ink"}`}>
            {l}{k ? ` · ${count(k)}` : ""}
          </Link>
        ))}
      </div>
      <Card pad={false}>
        {rows.length === 0 && <Empty>No messages yet.</Empty>}
        {rows.map((m) => (
          <div key={m.id} className="flex flex-col gap-1.5 border-b border-hair px-5 py-3 last:border-0">
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <Chip tone={TONE[m.status]}>{LABEL[m.status]}</Chip>
              <span className="font-semibold">{m.channel} · {m.to}</span>
              <span className="text-ink-muted">{m.event.split(":")[0]} · {fmtDateTime(m.createdAt)}</span>
              {m.bookingId && <a href={`/admin/bookings/${m.bookingId}`}>Booking</a>}
              {m.status !== "SENT" && (
                <form action={resendMessageAction} className="ml-auto"><input type="hidden" name="id" value={m.id} /><button className="btn-ghost btn-sm">Send again</button></form>
              )}
            </div>
            <p className="whitespace-pre-line text-sm text-ink-2">{m.body}</p>
            {m.error && <p className="text-xs text-rose-ink">{m.error}</p>}
          </div>
        ))}
      </Card>
    </div>
  );
}
