import { cookies } from "next/headers";
import type { Lang } from "@/lib/i18n";
import { prisma } from "./db";

/** Owner-editable website text (FR-W13). Missing keys fall back to these defaults. */
export const CONTENT_DEFAULTS: Record<string, { en: string; bn: string; label: string; multiline?: boolean }> = {
  phone: { en: "", bn: "", label: "Phone number (shown on the website)" },
  whatsapp: { en: "", bn: "", label: "WhatsApp number (with country code, e.g. 8801712345678)" },
  facebook: { en: "", bn: "", label: "Facebook page link" },
  meetingPoint: { en: "[Meeting point]", bn: "[দেখা করার জায়গা]", label: "Meeting point" },
  travelNote: {
    en: "Buses and cars from Dhaka and Chattogram reach Rangamati. Arrive by 12:30 for 13:00 boarding.",
    bn: "ঢাকা ও চট্টগ্রাম থেকে বাস ও গাড়িতে রাঙামাটি আসা যায়। দুপুর ১টায় ওঠার জন্য ১২:৩০-এর মধ্যে পৌঁছান।",
    label: "How to reach (short)", multiline: true,
  },
  heroTitle: { en: "A floating villa on Kaptai Lake", bn: "কাপ্তাই হ্রদের বুকে ভাসমান ভিলা", label: "Home page headline" },
  heroText: {
    en: "Glass-walled cabins, a rooftop deck and a jacuzzi on the water. Two days and one night: board at 13:00, swim, kayak and watch the moon rise, back by 11:00.",
    bn: "কাঁচঘেরা কেবিন, ছাদের ডেক আর পানির ওপর জাকুজি। দুই দিন এক রাত: দুপুর ১টায় ওঠা, সাঁতার, কায়াক, চাঁদ ওঠা দেখা, সকাল ১১টায় ফেরা।",
    label: "Home page intro", multiline: true,
  },
  cancellation: {
    en: "Refunds are at Mayaleen's discretion until a cancellation policy is published. Please call us as early as you can.",
    bn: "বাতিলের নীতি প্রকাশ না হওয়া পর্যন্ত টাকা ফেরত মায়ালীনের বিবেচনায়। যত তাড়াতাড়ি সম্ভব কল করুন।",
    label: "Cancellation answer (FAQ)", multiline: true,
  },
  terms: {
    en: "Bookings are confirmed when the first payment is verified. Every adult must show an NID (or passport) at boarding. Refunds are at Mayaleen's discretion until a cancellation policy is published. Guests follow the crew's safety instructions and wear life jackets on the water.",
    bn: "প্রথম পেমেন্ট যাচাই হলে বুকিং নিশ্চিত হয়। ওঠার সময় প্রত্যেক প্রাপ্তবয়স্ককে এনআইডি (বা পাসপোর্ট) দেখাতে হবে। বাতিলের নীতি প্রকাশ না হওয়া পর্যন্ত টাকা ফেরত মায়ালীনের বিবেচনায়। পানিতে অতিথিরা ক্রুর নির্দেশ মানবেন ও লাইফ জ্যাকেট পরবেন।",
    label: "Terms page", multiline: true,
  },
  reviews: {
    en: "", bn: "",
    label: "Guest reviews (one per line: quote | name)", multiline: true,
  },
};

export type Content = Record<keyof typeof CONTENT_DEFAULTS, string>;

export async function getContent(lang: Lang): Promise<Content> {
  let rows: { key: string; en: string; bn: string }[] = [];
  try {
    rows = await prisma.siteContent.findMany();
  } catch {
    rows = [];
  }
  const by = new Map(rows.map((r) => [r.key, r]));
  const out = {} as Content;
  for (const [k, d] of Object.entries(CONTENT_DEFAULTS)) {
    const r = by.get(k);
    out[k as keyof Content] = (lang === "bn" ? r?.bn || r?.en || d.bn || d.en : r?.en || d.en) ?? "";
  }
  return out;
}

export async function getLang(): Promise<Lang> {
  const c = (await cookies()).get("lang")?.value;
  return c === "bn" ? "bn" : "en";
}
