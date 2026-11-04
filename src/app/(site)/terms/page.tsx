import { getContent, getLang } from "@/server/site-content";

export const metadata = { title: "Terms · Mayaleen" };

export default async function Terms() {
  const lang = await getLang();
  const c = await getContent(lang);
  return (
    <main className="mx-auto max-w-2xl px-4 pb-10 pt-12 md:pt-16">
      <h1 className={`text-[36px] font-light leading-tight tracking-[-0.5px] md:text-[48px] ${lang === "bn" ? "font-bnDisplay" : "font-display"}`}>{lang === "bn" ? "শর্তাবলি" : "Terms"}</h1>
      <div className="mt-5 whitespace-pre-line text-[15px] leading-7 text-ink-2">{c.terms}</div>
      <h2 className="mt-8 text-lg font-semibold">{lang === "bn" ? "বাতিল ও টাকা ফেরত" : "Cancellation and refunds"}</h2>
      <p className="mt-2 whitespace-pre-line text-[15px] leading-7 text-ink-2">{c.cancellation}</p>
    </main>
  );
}
