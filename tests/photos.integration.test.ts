import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { getSitePhotos, sniffImage } from "@/server/photos";

const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);

describe("website photos", () => {
  beforeEach(async () => { await prisma.sitePhoto.deleteMany(); });
  afterAll(async () => { await prisma.sitePhoto.deleteMany(); });

  it("detects real image types and rejects everything else", () => {
    expect(sniffImage(JPG)).toBe("image/jpeg");
    expect(sniffImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("image/png");
    expect(sniffImage(Buffer.from("RIFF\0\0\0\0WEBPVP8 ", "latin1"))).toBe("image/webp");
    expect(sniffImage(Buffer.from("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffImage(Buffer.from("%PDF-1.7"))).toBeNull();
  });

  it("uses the built-in photos until the owner uploads some", async () => {
    const p = await getSitePhotos();
    expect(p.hero.src).toBe("/photos/river.jpg");
    expect(p.gallery.length).toBe(5);
    expect(p.cabins.length).toBeGreaterThan(0);
  });

  it("uploaded photos replace the built-in ones per place, in order, with their crop focus", async () => {
    const base = { mime: "image/jpeg", width: 10, height: 10, size: JPG.length, data: JPG };
    const a = await prisma.sitePhoto.create({ data: { ...base, place: "GALLERY", sort: 2, alt: "second" } });
    const b = await prisma.sitePhoto.create({ data: { ...base, place: "GALLERY", sort: 1, alt: "first", focus: "bottom" } });
    const h = await prisma.sitePhoto.create({ data: { ...base, place: "HERO", sort: 1 } });
    const p = await getSitePhotos();
    expect(p.gallery.map((x) => x.src)).toEqual([`/img/${b.id}`, `/img/${a.id}`]);
    expect(p.gallery[0].pos).toBe("50% 85%");
    expect(p.hero.src).toBe(`/img/${h.id}`);
    expect(p.hero.alt).toBeTruthy();
    expect(p.boat.src).toBe("/photos/deck.jpg");
  });
});
