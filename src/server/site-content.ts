import { cookies } from "next/headers";
import type { Lang } from "@/lib/i18n";
import { prisma } from "./db";

/**
 * Everything the owner can edit on the public website (FR-W13), in English and Bangla.
 * Stored in SiteContent: text → en/bn columns; list → JSON rows per language; toggle → en "1"/"0".
 * A key that was never saved shows its default below. Headings accept *word* for italics.
 */

type Text = { type: "text"; label: string; en: string; bn: string; long?: boolean; help?: string };
type Col = { id: string; label: string; long?: boolean };
type Row = Record<string, string>;
type List = { type: "list"; label: string; cols: Col[]; en: Row[]; bn: Row[]; help?: string };
type Toggle = { type: "toggle"; label: string; on: boolean };

const text = (label: string, en: string, bn: string, o: { long?: boolean; help?: string } = {}) => ({ type: "text" as const, label, en, bn, ...o }) satisfies Text;
const toggle = (label: string, on = true) => ({ type: "toggle" as const, label, on }) satisfies Toggle;
function list(label: string, cols: Col[], en: string[][], bn: string[][], help?: string) {
  const rows = (data: string[][]) => data.map((r) => Object.fromEntries(cols.map((c, i) => [c.id, r[i] ?? ""])));
  return { type: "list" as const, label, cols, en: rows(en), bn: rows(bn), help } satisfies List;
}

const ITALIC = "Put *stars* around words to show them in italics.";

export const FIELDS = {
  // ---------- Business details ----------
  siteName: text("Website name (shown in the header and footer)", "Mayaleen", "মায়ালীন"),
  phone: text("Phone number", "", "", { help: "Shown on the website. Leave empty to hide." }),
  whatsapp: text("WhatsApp number", "", "", { help: "With country code, e.g. 8801712345678. Leave empty to hide." }),
  facebook: text("Facebook page link", "", "", { help: "Full link, e.g. https://facebook.com/mayaleen" }),
  meetingPoint: text("Meeting point", "[Meeting point]", "[দেখা করার জায়গা]"),
  travelNote: text("How to reach (short)", "Buses and cars from Dhaka and Chattogram reach Rangamati. Arrive by 12:30 for 13:00 boarding.", "ঢাকা ও চট্টগ্রাম থেকে বাস ও গাড়িতে রাঙামাটি আসা যায়। দুপুর ১টায় ওঠার জন্য ১২:৩০-এর মধ্যে পৌঁছান।", { long: true }),

  // ---------- Search engines & sharing ----------
  seoTitle: text("Home page title (browser tab, Google, Facebook shares)", "Mayaleen · Floating villa on Kaptai Lake", "মায়ালীন · কাপ্তাই হ্রদের ভাসমান ভিলা"),
  seoDescription: text("Home page description (Google, Facebook shares)", "Glass-walled cabins, a rooftop deck and a jacuzzi on Kaptai Lake, Rangamati. Book shared cabins or the whole boat.", "রাঙামাটির কাপ্তাই হ্রদে কাঁচঘেরা কেবিন, ছাদের ডেক আর জাকুজি। শেয়ার্ড কেবিন বা পুরো বোট বুক করুন।", { long: true }),
  boatSeoTitle: text("Boat page title", "The boat, packages and itinerary · Mayaleen", "বোট, প্যাকেজ ও ভ্রমণসূচি · মায়ালীন"),
  bookSeoTitle: text("Booking page title", "Check dates and book · Mayaleen", "তারিখ দেখুন ও বুক করুন · মায়ালীন"),

  // ---------- Header & menu ----------
  navBoat: text("Menu: the boat", "The boat", "বোট"),
  navPackages: text("Menu: packages", "Packages & prices", "প্যাকেজ ও দাম"),
  navItinerary: text("Menu: itinerary", "Itinerary", "ভ্রমণসূচি"),
  navGallery: text("Menu: gallery", "Gallery", "ছবি"),
  navReach: text("Menu: how to reach", "How to reach", "কীভাবে যাবেন"),
  navMyBooking: text("Menu: my booking", "My booking", "আমার বুকিং"),
  navBookNow: text("Book button", "Book now", "এখনই বুক করুন"),
  navCall: text("Call button", "Call us", "কল করুন"),
  navMenu: text("Phone menu button (screen readers)", "Menu", "মেনু"),
  barFrom: text("Phone booking bar: “from”", "from", "শুরু"),
  barPer: text("Phone booking bar: “per guest”", "/ guest", "/ জন"),

  // ---------- Footer ----------
  footerTagline: text("Footer: tagline", "Floating villa on Kaptai Lake, Rangamati.", "কাপ্তাই হ্রদ, রাঙামাটির ভাসমান ভিলা।"),
  footerVisit: text("Footer: “Visit” heading", "Visit", "ঠিকানা"),
  footerBoarding: text("Footer: boarding line", "Boarding at {place}", "{place} থেকে যাত্রা", { help: "{place} = meeting point" }),
  footerTalk: text("Footer: “Talk to us” heading", "Talk to us", "যোগাযোগ"),
  footerExplore: text("Footer: “Explore” heading", "Explore", "দেখুন"),
  footerPay: text("Footer: payment heading", "Pay safely", "নিরাপদ পেমেন্ট"),
  footerPayText: text("Footer: payment text", "Bank transfer only, after we confirm. Pay in full or a 50% advance.", "শুধু ব্যাংক ট্রান্সফার, আমরা নিশ্চিত করার পর। পুরো টাকা বা ৫০% অগ্রিম।", { long: true }),
  footerTerms: text("Footer: terms link", "Terms", "শর্তাবলি"),

  // ---------- Home: top ----------
  heroEyebrow: text("Small line above the headline", "Kaptai Lake · Rangamati", "কাপ্তাই হ্রদ · রাঙামাটি"),
  heroTitle: text("Headline", "A *floating* villa on Kaptai Lake", "কাপ্তাই হ্রদের বুকে *ভাসমান* ভিলা", { help: ITALIC }),
  heroText: text("Text under the headline", "Glass-walled cabins, a rooftop deck and a jacuzzi on the water. Swim, kayak and watch the moon rise over the hills.", "কাঁচঘেরা কেবিন, ছাদের ডেক আর পানির ওপর জাকুজি। সাঁতার, কায়াক আর পাহাড়ের ওপর চাঁদ ওঠা দেখুন।", { long: true }),
  showHeroCard: toggle("Show the “Every trip” box"),
  heroCardLabel: text("Box: small label", "Every trip", "প্রতিটি ট্রিপ"),
  heroCardTitle: text("Box: title", "2 days · 1 night", "২ দিন · ১ রাত"),
  heroCardText: text("Box: text", "Board 13:00 · check out 11:00", "দুপুর ১টায় ওঠা · ১১টায় চেক আউট"),

  // ---------- Home: search bar ----------
  searchDate: text("Date label", "Trip date", "যাত্রার তারিখ"),
  searchAdults: text("Adults label", "Adults", "প্রাপ্তবয়স্ক"),
  searchChildren: text("Children label", "Children (4–10)", "শিশু (৪–১০)"),
  searchPackage: text("Package label", "Package", "প্যাকেজ"),
  searchShared: text("Option: shared cabins", "Shared cabins", "শেয়ার্ড কেবিন"),
  searchFull: text("Option: whole boat", "Whole boat", "পুরো বোট"),
  searchButton: text("Button", "Check availability", "খালি আছে কি না দেখুন"),
  searchNote: text("Note under the bar", "Live prices for your date. Shared cabins need 2 or more cabins. No payment until we confirm.", "আপনার তারিখের দাম সঙ্গে সঙ্গে দেখুন। শেয়ার্ড বুকিংয়ে কমপক্ষে ২টি কেবিন লাগে। আমরা নিশ্চিত না করা পর্যন্ত কোনো টাকা দিতে হবে না।", { long: true }),

  // ---------- Home: highlights strip ----------
  showMarquee: toggle("Show the moving highlights strip"),
  marquee: list("Highlights", [{ id: "word", label: "Highlight" }],
    [["Glass cabins"], ["Rooftop jacuzzi"], ["Swim & kayak"], ["Moonrise on the lake"], ["Meals cooked on board"], ["Hanging Bridge"]],
    [["কাঁচঘেরা কেবিন"], ["ছাদে জাকুজি"], ["সাঁতার ও কায়াক"], ["হ্রদে চাঁদ ওঠা"], ["বোটে রান্না করা খাবার"], ["ঝুলন্ত সেতু"]]),

  // ---------- Home: welcome ----------
  showIntro: toggle("Show this section"),
  introEyebrow: text("Small heading", "Welcome aboard", "স্বাগতম"),
  introTitle: text("Heading", "Glass walls, open water, and *nothing on the schedule* but the lake.", "কাঁচের দেয়াল, খোলা পানি, আর *হ্রদ ছাড়া কোনো তাড়া নেই*।", { help: ITALIC }),
  introText: text("Text", "Mayaleen is a houseboat that leaves Rangamati at lunchtime and anchors in the quiet of Kaptai Lake for the night. Share it with other travellers cabin by cabin, or take the whole boat for your family, friends or team.", "মায়ালীন একটি হাউসবোট, যা দুপুরে রাঙামাটি থেকে ছেড়ে রাতটা কাপ্তাই হ্রদের নিরিবিলিতে নোঙর করে। অন্য অতিথিদের সাথে কেবিন শেয়ার করুন, অথবা পরিবার, বন্ধু বা অফিসের জন্য পুরো বোট নিন।", { long: true }),
  introStats: list("Big numbers", [{ id: "value", label: "Number" }, { id: "label", label: "Text under it" }],
    [["{guests}", "guests at most, so it never feels crowded"], ["13:00", "boarding in Rangamati"], ["11:00", "check-out on day two"]],
    [["{guests}", "জন পর্যন্ত, তাই কখনো ভিড় লাগে না"], ["১:০০", "রাঙামাটিতে ওঠা"], ["১১:০০", "দ্বিতীয় দিন চেক আউট"]],
    "{guests} = the boat's guest limit from Booking rules."),

  // ---------- Home: packages ----------
  showPackages: toggle("Show this section"),
  pkEyebrow: text("Small heading", "Two ways to go", "দুইভাবে যেতে পারেন"),
  pkTitle: text("Heading", "Share the boat, or *have it to yourselves*", "কেবিন শেয়ার করুন, অথবা *পুরো বোট নিজেদের*", { help: ITALIC }),
  pkLink: text("Link next to the heading", "See prices for your date →", "আপনার তারিখের দাম দেখুন →"),
  sharedTag: text("Shared: badge", "Food included", "খাবারসহ"),
  sharedTitle: text("Shared: title", "Shared cabins", "শেয়ার্ড কেবিন"),
  sharedText: text("Shared: text", "Book 2 or more cabins for your group. Children 4–10 pay half, under 4 are free.", "আপনার দলের জন্য ২ বা তার বেশি কেবিন নিন। ৪–১০ বছরের শিশু অর্ধেক, ৪ বছরের নিচে ফ্রি।", { long: true }),
  sharedButton: text("Shared: button", "Choose cabins", "কেবিন বাছুন"),
  fullTag: text("Whole boat: badge", "Up to {n} guests", "{n} জন পর্যন্ত", { help: "{n} = guest limit" }),
  fullTitle: text("Whole boat: title", "The whole boat", "পুরো বোট"),
  fullText: text("Whole boat: text", "For families, friends and office trips. Add meals for {food} per guest.", "পরিবার, বন্ধু ও অফিসের ট্রিপের জন্য। খাবার জনপ্রতি {food}।", { long: true, help: "{food} = meal price per guest" }),
  fullButton: text("Whole boat: button", "Book the boat", "পুরো বোট বুক করুন"),
  priceFrom: text("Word before the price", "from", "শুরু"),
  perGuest: text("“per guest”", "per guest", "জনপ্রতি"),
  perTrip: text("“per trip”", "per trip", "প্রতি ট্রিপ"),
  daySunWed: text("Day type: Sunday–Wednesday", "Sun – Wed", "রবি – বুধ"),
  dayThuSat: text("Day type: Thursday & Saturday", "Thu / Sat", "বৃহস্পতি / শনি"),
  dayFri: text("Day type: Friday & holidays", "Fri & holidays", "শুক্র ও ছুটির দিন"),
  priceStrip: text("Price line under the cards", "{shared} shared cabins · {full} whole boat", "শেয়ার্ড কেবিন {shared} · পুরো বোট {full}", { help: "{shared} and {full} = that day's prices" }),

  // ---------- Home: on board ----------
  showOnboard: toggle("Show this section"),
  onboardEyebrow: text("Small heading", "On board", "বোটে"),
  onboardTitle: text("Heading", "What you will *actually do*", "যা যা *করবেন*", { help: ITALIC }),
  onboardList: list("Activities", [{ id: "title", label: "Title" }, { id: "text", label: "Text", long: true }],
    [["Swim, kayak and fish", "Life rings and jackets on board. Jump in straight from the deck."], ["Sunset on the rooftop deck", "Loungers, the jacuzzi, and the hills turning gold."], ["Moonrise and stargazing", "No city lights out here. Dinner cooked on board, then the sky."], ["Hanging Bridge & Shuvolong", "A tourist boat takes you there on day two."]],
    [["সাঁতার, কায়াক ও মাছ ধরা", "বোটে লাইফ রিং ও জ্যাকেট আছে। ডেক থেকেই পানিতে নামুন।"], ["ছাদের ডেকে সূর্যাস্ত", "লাউঞ্জার, জাকুজি আর সোনালি পাহাড়।"], ["চাঁদ ওঠা ও তারা দেখা", "শহরের আলো নেই। বোটে রাতের খাবার, তারপর আকাশ।"], ["ঝুলন্ত সেতু ও শুভলং", "দ্বিতীয় দিন ট্যুরিস্ট বোটে নিয়ে যাওয়া হয়।"]]),

  // ---------- Home: two days ----------
  showDays: toggle("Show this section"),
  daysEyebrow: text("Small heading", "Your two days", "আপনার দুই দিন"),
  daysTitle: text("Heading", "A night on the water, *a day around Rangamati*", "এক রাত পানিতে, *এক দিন রাঙামাটি ঘোরা*", { help: ITALIC }),
  daysLink: text("Link next to the heading", "Full itinerary →", "পুরো ভ্রমণসূচি →"),
  daysList: list("Timeline", [{ id: "when", label: "When" }, { id: "title", label: "Title" }, { id: "text", label: "Text", long: true }],
    [["Day 1 · 13:00", "Board in Rangamati", "Settle into your cabin, plant a tree, lunch on board."], ["Day 1 · afternoon", "Swim, kayak, fish", "Then a sunset cruise with snacks on deck."], ["Day 1 · night", "Moon watch & dinner", "On the rooftop, with the lake outside the glass."], ["Day 2 · 11:00", "Check out, explore", "Hanging Bridge, Shuvolong and an Adivasi village. Trip ends 18:00."]],
    [["১ম দিন · ১টা", "রাঙামাটিতে ওঠা", "কেবিনে উঠুন, গাছ লাগান, বোটে দুপুরের খাবার।"], ["১ম দিন · বিকেল", "সাঁতার, কায়াক, মাছ ধরা", "তারপর ডেকে নাশতাসহ সূর্যাস্ত ক্রুজ।"], ["১ম দিন · রাত", "চাঁদ দেখা ও রাতের খাবার", "ছাদে, কাঁচের বাইরে হ্রদ।"], ["২য় দিন · ১১টা", "চেক আউট, ঘোরাঘুরি", "ঝুলন্ত সেতু, শুভলং আর আদিবাসী গ্রাম। সন্ধ্যা ৬টায় শেষ।"]]),

  // ---------- Home: gallery ----------
  showGallery: toggle("Show this section"),
  galleryTitle: text("Heading", "Moments *from the lake*", "হ্রদের *কিছু মুহূর্ত*", { help: ITALIC }),
  galleryLink: text("Facebook link text (shown when a Facebook page is set)", "Follow us on Facebook →", "ফেসবুকে আমাদের দেখুন →"),

  // ---------- Home: reviews ----------
  showReviews: toggle("Show this section (when there are reviews)"),
  reviewsEyebrow: text("Small heading", "Guests say", "অতিথিরা বলেন"),
  reviews: list("Reviews", [{ id: "quote", label: "What the guest said", long: true }, { id: "name", label: "Name, month" }], [], [],
    "The first review is shown large; the next three below it."),

  // ---------- Home: FAQ ----------
  showFaq: toggle("Show this section"),
  faqEyebrow: text("Small heading", "Questions", "প্রশ্ন"),
  faqTitle: text("Heading", "Good to know", "জেনে রাখুন", { help: ITALIC }),
  faqLead: text("Text under the heading", "Still unsure? Call or WhatsApp us, we answer every day.", "আরও জানতে কল বা হোয়াটসঅ্যাপ করুন, আমরা প্রতিদিন উত্তর দিই।", { long: true }),
  faqList: list("Questions and answers", [{ id: "q", label: "Question" }, { id: "a", label: "Answer", long: true }],
    [
      ["How do I pay?", "By bank transfer to Mayaleen's account, after we confirm. Pay in full, or 50% now and the rest 24 hours before boarding. Put your booking reference in the transfer note and upload a screenshot on your booking page."],
      ["Can we bring children?", "Yes. Children 4–10 pay half, under 4 are free. Children count toward cabin space."],
      ["What do we need to bring?", "The NID card of every adult (passport for foreign guests). We record them at boarding, as the law requires."],
      ["What if we need to cancel?", "Refunds are at Mayaleen's discretion until a cancellation policy is published. Please call us as early as you can."],
    ],
    [
      ["কীভাবে টাকা দেব?", "আমরা নিশ্চিত করার পর মায়ালীনের ব্যাংক অ্যাকাউন্টে ট্রান্সফার করে। পুরো টাকা, অথবা এখন ৫০% আর বাকিটা যাত্রার ২৪ ঘণ্টা আগে। ট্রান্সফার নোটে বুকিং রেফারেন্স লিখুন এবং বুকিং পেজে স্ক্রিনশট দিন।"],
      ["শিশুদের নিয়ে যেতে পারি?", "হ্যাঁ। ৪–১০ বছরের শিশু অর্ধেক দাম, ৪ বছরের নিচে ফ্রি। শিশুরাও কেবিনের জায়গা নেয়।"],
      ["কী সঙ্গে আনতে হবে?", "প্রত্যেক প্রাপ্তবয়স্কের এনআইডি কার্ড (বিদেশিদের পাসপোর্ট)। আইন অনুযায়ী আমরা ওঠার সময় তা লিখে রাখি।"],
      ["বাতিল করতে হলে কী হবে?", "বাতিলের নীতি প্রকাশ না হওয়া পর্যন্ত টাকা ফেরত মায়ালীনের বিবেচনায়। যত তাড়াতাড়ি সম্ভব কল করুন।"],
    ]),

  // ---------- Home: how to reach ----------
  showReach: toggle("Show this section"),
  reachEyebrow: text("Small heading", "How to reach", "কীভাবে যাবেন"),
  reachTitle: text("Heading", "Meet us at *{place}*", "*{place}*-এ আমাদের সঙ্গে দেখা করুন", { help: `{place} = meeting point. ${ITALIC}` }),
  reachButton: text("Main button", "Check free dates", "খালি তারিখ দেখুন"),
  reachWhatsapp: text("WhatsApp button", "WhatsApp us", "হোয়াটসঅ্যাপ করুন"),

  // ---------- Boat page ----------
  boatEyebrow: text("Small line above the headline", "The boat", "বোট"),
  boatTitle: text("Headline", "A catamaran villa *built for the lake*", "হ্রদের জন্য তৈরি একটি *ক্যাটামারান ভিলা*", { help: ITALIC }),
  boatLead: text("Introduction", "Mayaleen is a fibreglass catamaran: steady on the water, quiet at anchor. Glass-walled AC cabins below, a lounge in the middle and a rooftop deck with a jacuzzi on top.", "মায়ালীন একটি ফাইবারগ্লাস ক্যাটামারান: পানিতে স্থির, নোঙরে নিঃশব্দ। নিচে কাঁচঘেরা এসি কেবিন, মাঝে লাউঞ্জ আর ছাদে জাকুজিসহ ডেক।", { long: true }),
  factGuests: text("Facts: “Guests” (number comes from Booking rules)", "Guests", "অতিথি"),
  factCabins: text("Facts: “Cabins” (number comes from Cabins)", "Cabins", "কেবিন"),
  factTrip: text("Facts: “Trip”", "Trip", "ট্রিপ"),
  factTripValue: text("Facts: trip length", "2 days · 1 night", "২ দিন · ১ রাত"),
  factBoarding: text("Facts: “Boarding”", "Boarding", "ওঠা"),
  factBoardingValue: text("Facts: boarding time and place", "13:00, Rangamati", "দুপুর ১টা, রাঙামাটি"),
  cabinsEyebrow: text("Cabins: small heading", "Cabins", "কেবিন"),
  cabinsTitle: text("Cabins: heading", "Wake up *to the water*", "পানির দিকে তাকিয়ে *ঘুম ভাঙবে*", { help: `Cabin names and descriptions are edited in Settings › Cabins. ${ITALIC}` }),
  cabinSleeps: text("Cabins: “Sleeps up to”", "Sleeps up to {n}", "{n} জন পর্যন্ত"),
  cabinCount: text("Cabins: how many", "{n} × cabin", "{n}টি কেবিন"),
  showAmenities: toggle("Show the amenity tiles"),
  amenities: list("Amenity tiles", [{ id: "title", label: "Title" }, { id: "text", label: "Text" }],
    [["Lounge", "Sofas, dining table, music."], ["Rooftop deck", "Sunset, stars, the moon watch."], ["Jacuzzi", "On the roof, open in the evening."], ["Safety", "Life jackets for everyone and a trained crew."]],
    [["লাউঞ্জ", "সোফা, খাবার টেবিল, গান।"], ["ছাদের ডেক", "সূর্যাস্ত, তারা, চাঁদ দেখা।"], ["জাকুজি", "ছাদে, সন্ধ্যায় খোলা।"], ["নিরাপত্তা", "সবার জন্য লাইফ জ্যাকেট ও প্রশিক্ষিত ক্রু।"]]),
  boatPkEyebrow: text("Prices: small heading", "Packages", "প্যাকেজ"),
  boatPkTitle: text("Prices: heading", "One trip, *two ways to book*", "এক ট্রিপ, *বুকিংয়ের দুই উপায়*", { help: `Prices come from Settings › Rates. ${ITALIC}` }),
  colPackage: text("Price table: “Package” column", "Package", "প্যাকেজ"),
  colFood: text("Price table: “Food” column", "Food", "খাবার"),
  sharedRow: text("Price table: shared row", "Shared cabins", "শেয়ার্ড কেবিন"),
  sharedSub: text("Price table: shared note", "per guest · book 2 or more cabins", "জনপ্রতি · ২ বা তার বেশি কেবিন"),
  fullRow: text("Price table: whole boat row", "Whole boat", "পুরো বোট"),
  fullSub: text("Price table: whole boat note", "per trip · up to {n} guests", "প্রতি ট্রিপ · {n} জন পর্যন্ত"),
  foodIncl: text("Price table: shared food", "Included, fixed menu", "অন্তর্ভুক্ত, নির্দিষ্ট মেনু"),
  foodOpt: text("Price table: whole boat food", "{price} per guest, optional", "জনপ্রতি {price}, ঐচ্ছিক"),
  incTitle: text("“Included” heading", "Included", "অন্তর্ভুক্ত"),
  incList: list("Included", [{ id: "item", label: "Item" }],
    [["Cabin for the night, AC"], ["Lunch, snacks, dinner and breakfast (shared trips)"], ["Kayaks, fishing gear and life jackets"], ["Sunset cruise and the day-two tourist boat"]],
    [["এক রাতের কেবিন, এসি"], ["দুপুর, নাশতা, রাত ও সকালের খাবার (শেয়ার্ড ট্রিপ)"], ["কায়াক, মাছ ধরার সরঞ্জাম ও লাইফ জ্যাকেট"], ["সূর্যাস্ত ক্রুজ ও দ্বিতীয় দিনের ট্যুরিস্ট বোট"]]),
  notIncTitle: text("“Not included” heading", "Not included", "অন্তর্ভুক্ত নয়"),
  notIncList: list("Not included", [{ id: "item", label: "Item" }],
    [["Travel to Rangamati"], ["Entry tickets at tourist spots"]],
    [["রাঙামাটি পর্যন্ত যাতায়াত"], ["দর্শনীয় স্থানের টিকিট"]]),
  ageFree: text("Age price: free", "free", "ফ্রি"),
  ageFull: text("Age price: full", "full price", "পুরো দাম"),
  payNote: text("Payment note", "Pay in full, or {pct}% advance and the rest {h} hours before boarding.", "পুরো টাকা দিন, অথবা {pct}% অগ্রিম আর বাকিটা ওঠার {h} ঘণ্টা আগে।", { help: "{pct} and {h} come from Booking rules" }),
  showItinerary: toggle("Show the itinerary"),
  itEyebrow: text("Itinerary: small heading", "Itinerary", "ভ্রমণসূচি"),
  itTitle: text("Itinerary: heading", "Two days *on Kaptai Lake*", "কাপ্তাই হ্রদে *দুই দিন*", { help: ITALIC }),
  day1Title: text("Day 1 heading", "Day 1 · on the boat", "প্রথম দিন · বোটে"),
  day1: list("Day 1", [{ id: "time", label: "Time" }, { id: "what", label: "What happens" }],
    [["13:00", "Check in and settle into your cabin"], ["", "Tree plantation"], ["", "Lunch on board"], ["", "Swimming and kayaking"], ["", "Fishing"], ["Evening", "Sunset cruise"], ["", "Snacks on deck"], ["Night", "Moon watch on the rooftop"], ["", "Dinner"]],
    [["১:০০", "চেক ইন ও কেবিনে ওঠা"], ["", "বৃক্ষরোপণ"], ["", "বোটে দুপুরের খাবার"], ["", "সাঁতার ও কায়াকিং"], ["", "মাছ ধরা"], ["সন্ধ্যা", "সূর্যাস্ত ক্রুজ"], ["", "ডেকে নাশতা"], ["রাত", "ছাদে চাঁদ দেখা"], ["", "রাতের খাবার"]]),
  day2Title: text("Day 2 heading", "Day 2 · around Rangamati", "দ্বিতীয় দিন · রাঙামাটি ঘোরা"),
  day2: list("Day 2", [{ id: "time", label: "Time" }, { id: "what", label: "What happens" }],
    [["Morning", "Breakfast"], ["11:00", "Check out"], ["", "Tourist boat to Hanging Bridge"], ["", "Shuvolong Fountain"], ["", "Buddha Temple"], ["", "Lunch at Shorgo-chera"], ["", "Adivasi village"], ["18:00", "Trip ends"]],
    [["সকাল", "নাশতা"], ["১১:০০", "চেক আউট"], ["", "ঝুলন্ত সেতুতে ট্যুরিস্ট বোট"], ["", "শুভলং ঝর্ণা"], ["", "বৌদ্ধ মন্দির"], ["", "স্বর্গছেড়ায় দুপুরের খাবার"], ["", "আদিবাসী গ্রাম"], ["৬:০০", "ট্রিপ শেষ"]]),
  showReady: toggle("Show the closing box"),
  readyTitle: text("Closing box: heading", "Ready for *the lake?*", "হ্রদে যেতে *প্রস্তুত?*", { help: ITALIC }),
  readyText: text("Closing box: text", "See which dates are free and what your group pays.", "কোন তারিখ খালি আর আপনার দলের খরচ কত, দেখুন।"),
  readyButton: text("Closing box: button", "See free dates", "খালি তারিখ দেখুন"),

  // ---------- Booking pages ----------
  bookEyebrow: text("Booking page: small heading", "Book now", "এখনই বুক করুন"),
  bookTitle: text("Booking page: headline", "Pick a date, *we hold your cabins*", "তারিখ বাছুন, *আমরা কেবিন ধরে রাখব*", { help: ITALIC }),
  bookLead: text("Booking page: text", "Prices update as you choose. Nothing to pay until we confirm your booking.", "আপনি বাছাই করলেই দাম বদলাবে। আমরা নিশ্চিত না করা পর্যন্ত কোনো টাকা দিতে হবে না।", { long: true }),
  findTitle: text("Find my booking: headline", "Find my booking", "আমার বুকিং খুঁজুন"),
  findLead: text("Find my booking: text", "Enter your booking reference and mobile number. We'll text the private link to that number.", "বুকিং রেফারেন্স ও মোবাইল নম্বর দিন। ওই নম্বরে আমরা ব্যক্তিগত লিংক এসএমএস করব।", { long: true }),

  // ---------- Terms ----------
  termsTitle: text("Terms page: headline", "Terms", "শর্তাবলি"),
  terms: text("Terms", "Bookings are confirmed when the first payment is verified. Every adult must show an NID (or passport) at boarding. Refunds are at Mayaleen's discretion until a cancellation policy is published. Guests follow the crew's safety instructions and wear life jackets on the water.", "প্রথম পেমেন্ট যাচাই হলে বুকিং নিশ্চিত হয়। ওঠার সময় প্রত্যেক প্রাপ্তবয়স্ককে এনআইডি (বা পাসপোর্ট) দেখাতে হবে। বাতিলের নীতি প্রকাশ না হওয়া পর্যন্ত টাকা ফেরত মায়ালীনের বিবেচনায়। পানিতে অতিথিরা ক্রুর নির্দেশ মানবেন ও লাইফ জ্যাকেট পরবেন।", { long: true }),
  cancelTitle: text("Cancellation heading", "Cancellation and refunds", "বাতিল ও টাকা ফেরত"),
  cancellation: text("Cancellation policy", "Refunds are at Mayaleen's discretion until a cancellation policy is published. Please call us as early as you can.", "বাতিলের নীতি প্রকাশ না হওয়া পর্যন্ত টাকা ফেরত মায়ালীনের বিবেচনায়। যত তাড়াতাড়ি সম্ভব কল করুন।", { long: true }),
} satisfies Record<string, Text | List | Toggle>;

type Fields = typeof FIELDS;
export type ContentKey = keyof Fields;
export type TextKey = { [K in ContentKey]: Fields[K] extends { type: "text" } ? K : never }[ContentKey];
export type ListKey = { [K in ContentKey]: Fields[K] extends { type: "list" } ? K : never }[ContentKey];
export type ToggleKey = { [K in ContentKey]: Fields[K] extends { type: "toggle" } ? K : never }[ContentKey];
export type ContentRow = Row;
export type FieldDef = Text | List | Toggle;

/** Groups for the settings screen. Photos: which photo slots belong to the section. */
export const SECTIONS: { id: string; group: string; title: string; keys: ContentKey[]; photos?: string[] }[] = [
  { id: "business", group: "Whole website", title: "Business details", keys: ["siteName", "phone", "whatsapp", "facebook", "meetingPoint", "travelNote"], photos: ["LOGO"] },
  { id: "seo", group: "Whole website", title: "Google & sharing", keys: ["seoTitle", "seoDescription", "boatSeoTitle", "bookSeoTitle"] },
  { id: "header", group: "Whole website", title: "Header & menu", keys: ["navBoat", "navPackages", "navItinerary", "navGallery", "navReach", "navMyBooking", "navBookNow", "navCall", "navMenu", "barFrom", "barPer"] },
  { id: "footer", group: "Whole website", title: "Footer", keys: ["footerTagline", "footerVisit", "footerBoarding", "footerTalk", "footerExplore", "footerPay", "footerPayText", "footerTerms"] },
  { id: "hero", group: "Home page", title: "Top of the page", keys: ["heroEyebrow", "heroTitle", "heroText", "showHeroCard", "heroCardLabel", "heroCardTitle", "heroCardText"], photos: ["HERO"] },
  { id: "search", group: "Home page", title: "Date search bar", keys: ["searchDate", "searchAdults", "searchChildren", "searchPackage", "searchShared", "searchFull", "searchButton", "searchNote"] },
  { id: "marquee", group: "Home page", title: "Highlights strip", keys: ["showMarquee", "marquee"] },
  { id: "intro", group: "Home page", title: "Welcome", keys: ["showIntro", "introEyebrow", "introTitle", "introText", "introStats"], photos: ["INTRO"] },
  { id: "packages", group: "Home page", title: "Packages", keys: ["showPackages", "pkEyebrow", "pkTitle", "pkLink", "sharedTag", "sharedTitle", "sharedText", "sharedButton", "fullTag", "fullTitle", "fullText", "fullButton", "priceFrom", "perGuest", "perTrip", "daySunWed", "dayThuSat", "dayFri", "priceStrip"], photos: ["SHARED", "WHOLE"] },
  { id: "onboard", group: "Home page", title: "On board", keys: ["showOnboard", "onboardEyebrow", "onboardTitle", "onboardList"], photos: ["ONBOARD"] },
  { id: "days", group: "Home page", title: "Your two days", keys: ["showDays", "daysEyebrow", "daysTitle", "daysLink", "daysList"] },
  { id: "gallery", group: "Home page", title: "Gallery", keys: ["showGallery", "galleryTitle", "galleryLink"], photos: ["GALLERY"] },
  { id: "reviews", group: "Home page", title: "Reviews", keys: ["showReviews", "reviewsEyebrow", "reviews"] },
  { id: "faq", group: "Home page", title: "Questions (FAQ)", keys: ["showFaq", "faqEyebrow", "faqTitle", "faqLead", "faqList"] },
  { id: "reach", group: "Home page", title: "How to reach", keys: ["showReach", "reachEyebrow", "reachTitle", "reachButton", "reachWhatsapp"], photos: ["REACH"] },
  { id: "boatTop", group: "Boat page", title: "Top & facts", keys: ["boatEyebrow", "boatTitle", "boatLead", "factGuests", "factCabins", "factTrip", "factTripValue", "factBoarding", "factBoardingValue"], photos: ["BOAT"] },
  { id: "boatCabins", group: "Boat page", title: "Cabins & amenities", keys: ["cabinsEyebrow", "cabinsTitle", "cabinSleeps", "cabinCount", "showAmenities", "amenities"], photos: ["CABIN"] },
  { id: "boatPrices", group: "Boat page", title: "Prices & what's included", keys: ["boatPkEyebrow", "boatPkTitle", "colPackage", "colFood", "sharedRow", "sharedSub", "fullRow", "fullSub", "foodIncl", "foodOpt", "incTitle", "incList", "notIncTitle", "notIncList", "ageFree", "ageFull", "payNote"] },
  { id: "boatItinerary", group: "Boat page", title: "Itinerary & closing box", keys: ["showItinerary", "itEyebrow", "itTitle", "day1Title", "day1", "day2Title", "day2", "showReady", "readyTitle", "readyText", "readyButton"] },
  { id: "booking", group: "Other pages", title: "Booking pages", keys: ["bookEyebrow", "bookTitle", "bookLead", "findTitle", "findLead"], photos: ["BOOK"] },
  { id: "terms", group: "Other pages", title: "Terms & cancellation", keys: ["termsTitle", "terms", "cancelTitle", "cancellation"] },
];

export type Content = Record<TextKey, string> & {
  list(key: ListKey): Row[];
  on(key: ToggleKey): boolean;
};

const parseRows = (s: string | undefined): Row[] | null => {
  if (s === undefined) return null;
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.filter((r) => r && typeof r === "object") : null;
  } catch {
    return null;
  }
};

/** The rows of a list for one language: Bangla cells fall back to the English ones. */
export function listFor(def: List, stored: { en: string; bn: string } | undefined, lang: Lang): Row[] {
  const en = parseRows(stored?.en) ?? def.en;
  if (lang === "en") return en;
  const bn = parseRows(stored?.bn) ?? (stored ? [] : def.bn);
  return en.map((r, i) => Object.fromEntries(def.cols.map((c) => [c.id, (bn[i]?.[c.id] ?? "").trim() || r[c.id] || ""])));
}

/** Both languages' rows, aligned by position, for the settings editor. */
export function editorRows(def: List, stored: { en: string; bn: string } | undefined): { en: Row[]; bn: Row[] } {
  const en = parseRows(stored?.en) ?? def.en;
  const bn = parseRows(stored?.bn) ?? (stored ? [] : def.bn);
  const pick = (r: Row | undefined) => Object.fromEntries(def.cols.map((c) => [c.id, String(r?.[c.id] ?? "")]));
  return { en: en.map(pick), bn: en.map((_, i) => pick(bn[i])) };
}

/** Cleans list JSON coming from the settings form: known columns only, trimmed, bounded. */
export function cleanRows(raw: unknown, def: List): Row[] {
  let v: unknown;
  try { v = JSON.parse(String(raw ?? "[]")); } catch { v = []; }
  if (!Array.isArray(v)) return [];
  return v.slice(0, 60).map((r) => Object.fromEntries(def.cols.map((c) => [c.id, String((r as Row)?.[c.id] ?? "").trim().slice(0, 2000)])));
}

export async function getContent(lang: Lang): Promise<Content> {
  let rows: { key: string; en: string; bn: string }[] = [];
  try {
    rows = await prisma.siteContent.findMany();
  } catch {
    rows = [];
  }
  const by = new Map(rows.map((r) => [r.key, r]));
  const out: Record<string, unknown> = {};
  for (const [k, d] of Object.entries(FIELDS) as [ContentKey, FieldDef][]) {
    if (d.type !== "text") continue;
    const r = by.get(k);
    // A saved row wins, even when empty (the owner removed that text); Bangla falls back to English.
    out[k] = r ? (lang === "bn" ? r.bn || r.en : r.en) : lang === "bn" ? d.bn || d.en : d.en;
  }
  out.list = (k: ListKey) => listFor(FIELDS[k] as List, by.get(k), lang).filter((row) => Object.values(row).some((v) => v.trim()));
  out.on = (k: ToggleKey) => {
    const r = by.get(k);
    return r ? r.en === "1" : (FIELDS[k] as Toggle).on;
  };
  return out as Content;
}

export async function getLang(): Promise<Lang> {
  return (await cookies()).get("lang")?.value === "bn" ? "bn" : "en";
}
