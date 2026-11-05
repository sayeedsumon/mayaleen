import { prisma } from "@/server/db";

export const PLACES = ["LOGO", "HERO", "INTRO", "SHARED", "WHOLE", "ONBOARD", "GALLERY", "REACH", "BOAT", "CABIN", "BOOK"] as const;
export type Place = (typeof PLACES)[number];
export const PLACE_LABEL: Record<Place, string> = {
  LOGO: "Logo (header)",
  HERO: "Home – top picture",
  INTRO: "Home – welcome pictures",
  SHARED: "Home – shared cabins card",
  WHOLE: "Home – whole boat card",
  ONBOARD: "Home – “On board” picture",
  GALLERY: "Home – gallery",
  REACH: "Home – “How to reach” background",
  BOAT: "Boat page – top picture",
  CABIN: "Boat & booking pages – cabin pictures",
  BOOK: "Booking page – trip summary picture",
};
/** How each place uses its photos (shown in Settings › Website photos). */
export const PLACE_NOTE: Record<Place, string> = {
  LOGO: "Optional. Replaces the written name in the header. Use a wide PNG with a transparent background. On the home and boat pages it sits over the top photo, so a white or light logo reads best.",
  HERO: "The first photo is shown, full screen.",
  INTRO: "The first photo is the large one, the second the small one in front.",
  SHARED: "The first photo is shown.",
  WHOLE: "The first photo is shown.",
  ONBOARD: "The first photo is shown.",
  GALLERY: `Up to 9 are shown; the first one is large.`,
  REACH: "The first photo is shown behind the text.",
  BOAT: "The first photo is shown, full width.",
  CABIN: "Used in turn: the first for the first cabin type, the second for the next, and so on.",
  BOOK: "The first photo is shown above the trip summary.",
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

export type SitePhotos = {
  logo: SitePic | null; hero: SitePic; intro: [SitePic, SitePic]; shared: SitePic; whole: SitePic; onboard: SitePic;
  gallery: SitePic[]; reach: SitePic; boat: SitePic; cabins: SitePic[]; book: SitePic;
};

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
  const intro = at("INTRO"), cabins = at("CABIN"), gallery = at("GALLERY");
  return {
    logo: at("LOGO")[0] ?? null,
    hero: at("HERO")[0] ?? D.river,
    intro: [intro[0] ?? D.deck, intro[1] ?? D.swim],
    shared: at("SHARED")[0] ?? D.cabin,
    whole: at("WHOLE")[0] ?? D.deck,
    onboard: at("ONBOARD")[0] ?? D.swim,
    gallery: (gallery.length ? gallery : [D.deck, D.swim, D.cabin, D.lounge, D.river]).slice(0, GALLERY_MAX),
    reach: at("REACH")[0] ?? D.deck,
    boat: at("BOAT")[0] ?? D.deck,
    cabins: cabins.length ? cabins : [D.cabin, D.lounge],
    book: at("BOOK")[0] ?? D.river,
  };
}

/** Detects the real image type from the first bytes; never trust the browser's label. */
export function sniffImage(buf: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}
