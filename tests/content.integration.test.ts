import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

import { italicParts, plain } from "@/lib/text-vars";
import { prisma } from "@/server/db";
import { FIELDS, SECTIONS, cleanRows, editorRows, getContent } from "@/server/site-content";

describe("website content (every public text editable)", () => {
  beforeEach(async () => { await prisma.siteContent.deleteMany(); });
  afterAll(async () => { await prisma.siteContent.deleteMany(); });

  it("every field belongs to exactly one settings section, and sections only name real fields", () => {
    const listed = SECTIONS.flatMap((s) => s.keys);
    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual(Object.keys(FIELDS).sort());
  });

  it("shows the defaults until the owner saves something", async () => {
    const en = await getContent("en");
    const bn = await getContent("bn");
    expect(en.heroTitle).toBe(FIELDS.heroTitle.en);
    expect(bn.heroTitle).toBe(FIELDS.heroTitle.bn);
    expect(en.list("faqList").length).toBe(4);
    expect(bn.list("faqList")[0].q).toBe(FIELDS.faqList.bn[0].q);
    expect(en.on("showFaq")).toBe(true);
    expect(en.list("reviews")).toEqual([]);
  });

  it("saved text wins, even when emptied; empty Bangla falls back to the saved English", async () => {
    await prisma.siteContent.createMany({ data: [
      { key: "heroTitle", en: "A new *headline*", bn: "" },
      { key: "heroEyebrow", en: "", bn: "" },
    ] });
    const en = await getContent("en");
    const bn = await getContent("bn");
    expect(en.heroTitle).toBe("A new *headline*");
    expect(bn.heroTitle).toBe("A new *headline*");
    expect(en.heroEyebrow).toBe("");
  });

  it("lists: rows in order, blank rows dropped, Bangla cells fall back per cell", async () => {
    await prisma.siteContent.create({ data: {
      key: "faqList",
      en: JSON.stringify([{ q: "Q1", a: "A1" }, { q: "", a: "" }, { q: "Q2", a: "A2" }]),
      bn: JSON.stringify([{ q: "প্রশ্ন১", a: "" }, {}, { q: "", a: "" }]),
    } });
    const en = await getContent("en");
    const bn = await getContent("bn");
    expect(en.list("faqList")).toEqual([{ q: "Q1", a: "A1" }, { q: "Q2", a: "A2" }]);
    expect(bn.list("faqList")).toEqual([{ q: "প্রশ্ন১", a: "A1" }, { q: "Q2", a: "A2" }]);
  });

  it("a saved empty list hides it; toggles switch sections off", async () => {
    await prisma.siteContent.createMany({ data: [
      { key: "marquee", en: "[]", bn: "[]" },
      { key: "showFaq", en: "0", bn: "" },
    ] });
    const c = await getContent("en");
    expect(c.list("marquee")).toEqual([]);
    expect(c.on("showFaq")).toBe(false);
    expect(c.on("showIntro")).toBe(true);
  });

  it("cleans list input from the form and aligns both languages for the editor", () => {
    const rows = cleanRows(JSON.stringify([{ q: "  Q ", a: "A", evil: "<script>" }, "junk"]), FIELDS.faqList);
    expect(rows).toEqual([{ q: "Q", a: "A" }, { q: "", a: "" }]);
    expect(cleanRows("not json", FIELDS.faqList)).toEqual([]);
    const v = editorRows(FIELDS.faqList, { en: JSON.stringify([{ q: "Q", a: "A" }]), bn: "[]" });
    expect(v.bn).toEqual([{ q: "", a: "" }]);
  });

  it("*stars* become italics and {placeholders} are filled", () => {
    expect(plain("Meet us at *{place}*", { place: "Reserve Bazar" })).toBe("Meet us at Reserve Bazar");
    expect(italicParts("A *floating* villa")).toEqual(["A ", "floating", " villa"]);
  });
});
