import { Banner, Card } from "@/components/ui";
import { requireUser } from "@/server/auth/current-user";
import { prisma } from "@/server/db";
import { CONTENT_DEFAULTS } from "@/server/site-content";
import { websiteContentAction } from "../../../_actions/settings";

export default async function WebsiteContent({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireUser("ADMIN_SETTINGS");
  const sp = await searchParams;
  const rows = new Map((await prisma.siteContent.findMany()).map((r) => [r.key, r]));
  return (
    <div className="flex flex-col gap-5">
      <Banner tone="ok">{sp.ok}</Banner>
      <Banner>{sp.error}</Banner>
      <p className="text-sm text-ink-2">Text and contact details on the public website, in English and Bangla. Leave Bangla empty to show the English text. Prices come from Rates; cabins from Cabins.</p>
      <form action={websiteContentAction} className="flex flex-col gap-4">
        {Object.entries(CONTENT_DEFAULTS).map(([key, d]) => {
          const r = rows.get(key);
          const Field = d.multiline ? "textarea" : "input";
          const cls = d.multiline ? "input min-h-[96px] py-2.5" : "input";
          return (
            <Card key={key} title={d.label}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="label">English<Field name={`${key}_en`} defaultValue={r?.en ?? d.en} className={cls} /></label>
                <label className="label">বাংলা<Field name={`${key}_bn`} defaultValue={r?.bn ?? d.bn} lang="bn" className={`${cls} font-bn`} /></label>
              </div>
            </Card>
          );
        })}
        <button className="btn self-start">Save website text</button>
      </form>
    </div>
  );
}
