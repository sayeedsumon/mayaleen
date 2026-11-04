import { prisma } from "@/server/db";

export const PLACES = ["HERO", "BOAT", "CABIN", "GALLERY"] as const;
export type Place = (typeof PLACES)[number];
export const PLACE_LABEL: Record<Place, string> = {
  HERO: "Home page – top picture",
  BOAT: "Boat page – top picture",
  CABIN: "Cabin cards",
  GALLERY: "Home page gallery",
};
export const FOCUS = { top: "50% 15%", center: "50% 50%", bottom: "50% 85%" } as const;
export type Focus = keyof typeof FOCUS;
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
export const GALLERY_MAX = 9;

export type SitePic = { src: string; alt: string; pos?: string };

/** Built-in photos shipped with the site, used until the owner uploads their own. */
const D = {
  river: { src: "/photos/river.jpg", alt: "A guest on the Mayaleen deck as the boat passes green hills", pos: "50% 35%" },
  deck: { src: "/photos/deck.jpg", alt: "Guests sitting at the bow, looking out over Kaptai Lake" },
  swim: { src: "/photos/swim.jpg", alt: "A guest floating in the lake with a life ring", pos: "50% 72%" },
  cabin: { src: "/photos/cabin.jpg", alt: "A cabin with wide windows", pos: "50% 40%" },
  lounge: { src: "/photos/lounge.jpg", alt: "The lounge on board", pos: "50% 30%" },
} satisfies Record<string, SitePic>;

export type SitePhotos = { hero: SitePic; boat: SitePic; cabins: SitePic[]; gallery: SitePic[]; reach: SitePic };

/** Photos for the public site: uploaded ones per place, falling back to the built-in set. */
export async function getSitePhotos(): Promise<SitePhotos> {
  let rows: { id: string; place: string; alt: string; focus: string }[] = [];
  try {
    rows = await prisma.sitePhoto.findMany({ select: { id: true, place: true, alt: true, focus: true }, orderBy: [{ sort: "asc" }, { createdAt: "asc" }] });
  } catch {
    rows = [];
  }
  const pic = (r: { id: string; alt: string; focus: string }): SitePic => ({ src: `/img/${r.id}`, alt: r.alt || "Mayaleen houseboat on Kaptai Lake", pos: FOCUS[r.focus as Focus] ?? FOCUS.center });
  const at = (p: Place) => rows.filter((r) => r.place === p).map(pic);
  const hero = at("HERO"), boat = at("BOAT"), cabins = at("CABIN"), gallery = at("GALLERY");
  return {
    hero: hero[0] ?? D.river,
    boat: boat[0] ?? D.deck,
    cabins: cabins.length ? cabins : [D.cabin, D.lounge],
    gallery: (gallery.length ? gallery : [D.deck, D.swim, D.cabin, D.lounge, D.river]).slice(0, GALLERY_MAX),
    reach: gallery[1] ?? hero[1] ?? D.swim,
  };
}

/** Detects the real image type from the first bytes; never trust the browser's label. */
export function sniffImage(buf: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}
