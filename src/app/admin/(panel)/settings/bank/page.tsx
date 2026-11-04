import { Card, ErrorBanner, btnCls, inputCls } from "../../../../../components/ui";
import { requireUser } from "../../../../../server/auth/current-user";
import { prisma } from "../../../../../server/db";
import { saveBankAccountAction } from "../../../actions";

function Fields({ a }: { a?: { id: string; bank: string; branch: string; accountName: string; accountNo: string; routingNo: string; isDefault: boolean; active: boolean } }) {
  return (
    <>
      {a && <input type="hidden" name="id" value={a.id} />}
      <div className="grid gap-2 md:grid-cols-5">
        <input name="bank" defaultValue={a?.bank} placeholder="Bank" required className={inputCls} />
        <input name="branch" defaultValue={a?.branch} placeholder="Branch" required className={inputCls} />
        <input name="accountName" defaultValue={a?.accountName} placeholder="Account name" required className={inputCls} />
        <input name="accountNo" defaultValue={a?.accountNo} placeholder="Account number" required className={inputCls} />
        <input name="routingNo" defaultValue={a?.routingNo} placeholder="Routing number" required className={inputCls} />
      </div>
      <div className="mt-2 flex items-center gap-4 text-sm">
        <label><input type="checkbox" name="isDefault" defaultChecked={a?.isDefault} /> Default account</label>
        {a && <label><input type="checkbox" name="active" defaultChecked={a.active} /> Active</label>}
        <button className={btnCls}>{a ? "Save" : "Add account"}</button>
      </div>
    </>
  );
}

export default async function BankSettings({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireUser("ADMIN_SETTINGS");
  const { error } = await searchParams;
  const accounts = await prisma.bankAccount.findMany({ orderBy: [{ isDefault: "desc" }, { bank: "asc" }] });
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Bank accounts shown on invoices</h1>
      <p className="text-sm text-slate-600">Changes apply to new invoices only. Issued invoices keep the details they were issued with.</p>
      <ErrorBanner message={error} />
      {accounts.map((a) => (
        <Card key={a.id}><form action={saveBankAccountAction}><Fields a={a} /></form></Card>
      ))}
      <Card title="Add account"><form action={saveBankAccountAction}><Fields /></form></Card>
    </div>
  );
}
