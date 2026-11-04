import { Banner, Card } from "@/components/ui";
import { requireUser } from "@/server/auth/current-user";
import { prisma } from "@/server/db";
import { saveBankAccountAction } from "../../../_actions/settings";

type Acct = { id: string; bank: string; branch: string; accountName: string; accountNo: string; routingNo: string; isDefault: boolean; active: boolean };

function Fields({ a }: { a?: Acct }) {
  return (
    <>
      {a && <input type="hidden" name="id" value={a.id} />}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
        <label className="label text-xs">Bank<input name="bank" defaultValue={a?.bank} required className="input" /></label>
        <label className="label text-xs">Branch<input name="branch" defaultValue={a?.branch} required className="input" /></label>
        <label className="label text-xs">Account name<input name="accountName" defaultValue={a?.accountName} required className="input" /></label>
        <label className="label text-xs">Account number<input name="accountNo" defaultValue={a?.accountNo} required className="input" /></label>
        <label className="label text-xs">Routing number<input name="routingNo" defaultValue={a?.routingNo} required className="input" /></label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="isDefault" defaultChecked={a?.isDefault} className="h-[18px] w-[18px] accent-lake" />Show on new invoices</label>
        {a && <label className="flex items-center gap-2"><input type="checkbox" name="active" defaultChecked={a.active} className="h-[18px] w-[18px] accent-lake" />Active</label>}
        <button className="btn ml-auto">{a ? "Save" : "Add account"}</button>
      </div>
    </>
  );
}

export default async function BankSettings({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireUser("ADMIN_SETTINGS");
  const sp = await searchParams;
  const accounts = await prisma.bankAccount.findMany({ orderBy: [{ isDefault: "desc" }, { bank: "asc" }] });
  const placeholder = accounts.some((a) => a.isDefault && /TBD/i.test(a.accountNo));
  return (
    <div className="flex flex-col gap-5">
      <Banner tone="ok">{sp.ok}</Banner>
      <Banner>{sp.error}</Banner>
      {placeholder && <Banner tone="warn">The default account still has placeholder details. Enter the real account before sending invoices.</Banner>}
      <p className="text-sm text-ink-2">Guests pay by bank transfer to the account shown on their invoice. Changes apply to new invoices only.</p>
      {accounts.map((a) => (
        <Card key={a.id} title={`${a.bank}${a.isDefault ? " · on new invoices" : ""}`}><form action={saveBankAccountAction}><Fields a={a} /></form></Card>
      ))}
      <Card title="Add account"><form action={saveBankAccountAction}><Fields /></form></Card>
    </div>
  );
}
