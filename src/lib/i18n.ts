export type Lang = "en" | "bn";

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
export const toBnDigits = (s: string) => s.replace(/\d/g, (d) => BN_DIGITS[Number(d)]);

/** Money in the visitor's language: "Tk 7,800" / "৭,৮০০ টাকা". */
export function money(n: number, lang: Lang) {
  const s = Math.round(n).toLocaleString("en-US");
  return lang === "bn" ? `${toBnDigits(s)} টাকা` : `Tk ${s}`;
}
export const num = (n: number, lang: Lang) => (lang === "bn" ? toBnDigits(String(n)) : String(n));

const MONTHS_BN = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS_BN = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];
const DAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAYS_SHORT_BN = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"];
const DAYS_SHORT_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const monthName = (m: number, lang: Lang) => (lang === "bn" ? MONTHS_BN : MONTHS_EN)[m];
export const dayShort = (w: number, lang: Lang) => (lang === "bn" ? DAYS_SHORT_BN : DAYS_SHORT_EN)[w];

/** "Saturday, 21 November" for an ISO trip date. */
export function tripDate(iso: string, lang: Lang, withYear = false) {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  const day = d.getUTCDate(), m = d.getUTCMonth(), w = d.getUTCDay(), y = d.getUTCFullYear();
  return lang === "bn"
    ? `${DAYS_BN[w]}, ${toBnDigits(String(day))} ${MONTHS_BN[m]}${withYear ? ` ${toBnDigits(String(y))}` : ""}`
    : `${DAYS_EN[w]}, ${day} ${MONTHS_EN[m]}${withYear ? ` ${y}` : ""}`;
}

/** Deadline instants shown in Asia/Dhaka. */
export function when(d: Date | null | undefined, lang: Lang) {
  if (!d) return "–";
  const s = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  if (lang === "en") return s;
  const local = new Date(d.getTime() + 6 * 3_600_000);
  return `${toBnDigits(String(local.getUTCDate()))} ${MONTHS_BN[local.getUTCMonth()]}, ${toBnDigits(s.slice(-5))}`;
}

const en = {
  nav: { boat: "The boat", packages: "Packages & prices", itinerary: "Itinerary", faq: "FAQ", reach: "How to reach", myBooking: "My booking", bookNow: "Book now", call: "Call us" },
  place: "Kaptai Lake · Rangamati",
  hero: { cta: "See free dates", tour: "Tour the boat" },
  search: { title: "Check availability", date: "Trip date", adults: "Adults", children: "Children (4–10)", infants: "Under 4", package: "Package", shared: "Shared cabins", full: "Whole boat", go: "Check availability", note: "Live prices for your date. Shared cabins need 2 or more cabins. No payment until we confirm." },
  highlights: [
    ["Glass-walled AC cabins", "Wake up to the lake through the glass. Each cabin sleeps up to 4."],
    ["Rooftop deck & jacuzzi", "Sunset on the roof, a soak in the jacuzzi, the moon over the hills."],
    ["Meals cooked on board", "Lunch, snacks, dinner and breakfast. Included on shared trips."],
    ["Kayaks, fishing, swimming", "Then a tourist boat to Hanging Bridge and Shuvolong on day two."],
  ],
  packages: {
    eyebrow: "Two ways to go", title: "Share the boat, or have it to yourselves",
    sharedTitle: "Shared cabins", sharedTag: "Food included", perGuest: "per guest", from: "from",
    sharedText: "Book 2 or more cabins for your group. Children 4–10 pay half, under 4 are free.", sharedCta: "Choose cabins",
    fullTitle: "The whole boat", fullTag: "Up to 16 guests", perTrip: "per trip",
    fullText: "For families, friends and office trips. Add meals for {food} per guest.", fullCta: "Book the boat",
    sunWed: "Sun – Wed", thuSat: "Thu / Sat", fri: "Fri & holidays",
  },
  how: {
    eyebrow: "Booking is simple", title: "Four steps, no payment until we confirm",
    steps: [["Pick a date", "See live prices and send a request. We hold your cabins."], ["We confirm", "Usually within a few hours, with your invoice by SMS."], ["Pay by bank transfer", "Full or 50% advance, from any bank or bKash/Nagad via NPSB."], ["Board at 13:00", "Bring the NID of every adult. Passports for foreign guests."]],
  },
  reviews: { eyebrow: "Guests say", title: "From our guests" },
  faq: {
    eyebrow: "Questions", title: "Good to know", lead: "Still unsure? Call or WhatsApp us, we answer every day.",
    items: [
      ["How do I pay?", "By bank transfer to Mayaleen's account, after we confirm. Pay in full, or 50% now and the rest 24 hours before boarding. Put your booking reference in the transfer note and upload a screenshot on your booking page."],
      ["Can we bring children?", "Yes. Children 4–10 pay half, under 4 are free. Children count toward cabin space."],
      ["What do we need to bring?", "The NID card of every adult (passport for foreign guests). We record them at boarding, as the law requires."],
    ],
    cancel: "What if we need to cancel?",
  },
  reach: { eyebrow: "How to reach", title: "Meet us at {place}", whatsapp: "WhatsApp us" },
  footer: { tagline: "Floating villa on Kaptai Lake, Rangamati.", terms: "Terms" },
  book: {
    title: "Pick your date", lead: "Prices update as you choose. Nothing to pay until we confirm your booking.",
    available: "Available", someLeft: "{n} cabins left", full: "Full", closed: "Closed", callUs: "Call us",
    pricePer: "Price per guest", pricePerBoat: "Price for the whole boat", cutoff: "Online booking closes {n} days before the trip. For sooner dates, please call us.",
    yourTrip: "Your trip", boardTimes: "Board 13:00 · back 11:00 the next day", pickDate: "Pick a date on the calendar",
    chooseCabins: "Choose cabins", atLeast2: "at least 2", sleeps: "sleeps {n}", booked: "Booked", selected: "Selected", free: "Free",
    meals: "Meals for the group", mealsNote: "{price} per guest", total: "Total",
    advance: "Pay in full, or {pct}% ({amount}) after we confirm and the rest 24 hours before boarding.",
    name: "Your name", namePh: "As on your NID", mobile: "Mobile number", nid: "NID number", nidPh: "10, 13 or 17 digits", email: "Email", optional: "optional",
    emailPh: "For your invoice", notes: "Anything we should know?", notesPh: "Birthday, dietary needs…",
    agree: "I agree to the terms. Every adult brings their NID to board.", send: "Send booking request",
    holdNote: "We hold your cabins for {h} hours while we confirm, and text you the invoice.",
    ok: "Looks good. Add your details to send the request.", needCabins: "Choose at least 2 cabins.",
    tooMany: "{n} guests need more cabins.", boatCap: "The boat takes up to {n} guests.", needGuests: "A booking needs at least 2 guests.",
    taken: "Just booked by someone else. Nearest free dates:", noneSoon: "none in the next 60 days. Please call us.",
    adultsHint: "11 and over", childrenHint: "Age 4–10, half price", infantsHint: "Free",
  },
  my: {
    ref: "Booking {ref}", pending: "Waiting for us to confirm", awaiting: "Approved · waiting for payment", submitted: "Payment proof received",
    balance: "Confirmed · balance due", paid: "Confirmed · paid in full", onboard: "On board", done: "Trip completed", closed: "Closed",
    heldUntil: "Cabins held until {t} while we confirm. We'll text you.", payBy: "Pay by {t}", left: "{t} left. If no payment arrives by then, the cabins are released.",
    checking: "We're checking your payment. The deadline is paused.", balanceBy: "Balance {amount} due by {t}.",
    paidMsg: "You're all set. Board at 13:00 and bring every adult's NID.",
    steps: ["Requested", "Approved", "Payment", "Confirmed"],
    howPay: "How would you like to pay?", advanceNow: "{pct}% advance now", restBy: "Rest {amount} by {t}", payFull: "Pay in full", nothingLater: "Nothing more to pay later",
    sendTo: "Send {amount} to", sendHow: "NPSB, BEFTN or bank deposit. From bKash/Nagad, use \"Send to bank\".",
    bank: "Bank", accountName: "Account name", accountNo: "Account number", routing: "Routing number", copy: "Copy", copied: "Copied",
    noteRef: "Write {ref} in the transfer note so we can find your payment.",
    proofTitle: "Paid? Send us the proof", amountSent: "Amount you sent (Tk)", sentAt: "Date and time", txn: "Transaction ID", txnPh: "From your bank SMS",
    sender: "Sender name", senderPh: "Name on the account", from: "Sent from", choose: "Choose bank or wallet", other: "Other",
    screenshot: "Add screenshot", screenshotHint: "JPG, PNG or PDF · up to 5 MB", sendProof: "Send payment proof", pauseNote: "Sending a proof pauses the deadline while we check it.",
    payments: "Your payments", totalL: "Total", paidL: "Paid", dueL: "Still due", invoice: "View invoice", accepted: "Accepted", rejected: "Not accepted", checkingL: "Checking",
    cancel: "Need to cancel? Send a request", cancelReason: "Reason (optional)", cancelSend: "Send cancel request", cancelSent: "Cancel request sent. We'll call you.",
    bring: "Bring the NID of every adult on the day.", meeting: "Meeting point: {place}.", proofThanks: "Thank you. We'll check your payment and text you.",
    trip: "{cabins} · {guests} · board 13:00", fullBoat: "Whole boat",
  },
  req: {
    title: "Request sent. Your cabins are held.", lead: "We'll confirm within a few hours and text your invoice to {mobile}.",
    refL: "Booking reference", waiting: "Waiting for us", heldUntil: "Held until {t} while we confirm.",
    next: "What happens next", nextSteps: ["We approve and send your invoice by SMS.", "Pay by bank transfer within 24 hours. Full, or 50% now.", "Upload the transfer screenshot on this page.", "Board at 13:00. Bring every adult's NID."],
    save: "Save this page's link. It is private to you.",
  },
};

export type Dict = typeof en;

const bn: Dict = {
  nav: { boat: "বোট", packages: "প্যাকেজ ও দাম", itinerary: "ভ্রমণসূচি", faq: "প্রশ্নোত্তর", reach: "কীভাবে যাবেন", myBooking: "আমার বুকিং", bookNow: "এখনই বুক করুন", call: "কল করুন" },
  place: "কাপ্তাই হ্রদ · রাঙামাটি",
  hero: { cta: "খালি তারিখ দেখুন", tour: "বোট ঘুরে দেখুন" },
  search: { title: "তারিখ দেখুন", date: "যাত্রার তারিখ", adults: "প্রাপ্তবয়স্ক", children: "শিশু (৪–১০)", infants: "৪ বছরের নিচে", package: "প্যাকেজ", shared: "শেয়ার্ড কেবিন", full: "পুরো বোট", go: "খালি আছে কি না দেখুন", note: "আপনার তারিখের দাম সঙ্গে সঙ্গে দেখুন। শেয়ার্ড বুকিংয়ে কমপক্ষে ২টি কেবিন লাগে। আমরা নিশ্চিত না করা পর্যন্ত কোনো টাকা দিতে হবে না।" },
  highlights: [
    ["কাঁচঘেরা এসি কেবিন", "কাঁচের দেয়াল দিয়ে হ্রদ দেখে ঘুম ভাঙবে। প্রতিটি কেবিনে ৪ জন পর্যন্ত।"],
    ["ছাদের ডেক ও জাকুজি", "ছাদে সূর্যাস্ত, জাকুজিতে বসা, পাহাড়ের ওপর চাঁদ।"],
    ["বোটেই রান্না করা খাবার", "দুপুর, নাশতা, রাত ও সকালের খাবার। শেয়ার্ড ট্রিপে খাবার অন্তর্ভুক্ত।"],
    ["কায়াক, মাছ ধরা, সাঁতার", "দ্বিতীয় দিনে ঝুলন্ত সেতু ও শুভলং যাওয়ার ট্যুরিস্ট বোট।"],
  ],
  packages: {
    eyebrow: "দুইভাবে যেতে পারেন", title: "কেবিন শেয়ার করুন, অথবা পুরো বোট নিজেদের",
    sharedTitle: "শেয়ার্ড কেবিন", sharedTag: "খাবার সহ", perGuest: "জনপ্রতি", from: "শুরু",
    sharedText: "আপনার দলের জন্য ২ বা তার বেশি কেবিন নিন। ৪–১০ বছরের শিশু অর্ধেক, ৪ বছরের নিচে ফ্রি।", sharedCta: "কেবিন বাছুন",
    fullTitle: "পুরো বোট", fullTag: "১৬ জন পর্যন্ত", perTrip: "প্রতি ট্রিপ",
    fullText: "পরিবার, বন্ধু ও অফিসের ট্রিপের জন্য। খাবার জনপ্রতি {food}।", fullCta: "পুরো বোট বুক করুন",
    sunWed: "রবি – বুধ", thuSat: "বৃহস্পতি / শনি", fri: "শুক্র ও ছুটির দিন",
  },
  how: {
    eyebrow: "সহজ বুকিং", title: "চার ধাপ, নিশ্চিত হওয়ার আগে কোনো টাকা নয়",
    steps: [["তারিখ বাছুন", "দাম দেখে অনুরোধ পাঠান। আমরা কেবিন ধরে রাখব।"], ["আমরা নিশ্চিত করি", "সাধারণত কয়েক ঘণ্টার মধ্যে, এসএমএসে ইনভয়েস।"], ["ব্যাংক ট্রান্সফারে দিন", "পুরো বা ৫০% অগ্রিম, যেকোনো ব্যাংক বা বিকাশ/নগদ থেকে NPSB-তে।"], ["দুপুর ১টায় উঠুন", "প্রত্যেক প্রাপ্তবয়স্কের এনআইডি আনুন। বিদেশিদের পাসপোর্ট।"]],
  },
  reviews: { eyebrow: "অতিথিরা বলেন", title: "আমাদের অতিথিদের কথা" },
  faq: {
    eyebrow: "প্রশ্ন", title: "জেনে রাখুন", lead: "আরও জানতে কল বা হোয়াটসঅ্যাপ করুন, আমরা প্রতিদিন উত্তর দিই।",
    items: [
      ["কীভাবে টাকা দেব?", "আমরা নিশ্চিত করার পর মায়ালীনের ব্যাংক অ্যাকাউন্টে ট্রান্সফার করে। পুরো টাকা, অথবা এখন ৫০% আর বাকিটা যাত্রার ২৪ ঘণ্টা আগে। ট্রান্সফার নোটে বুকিং রেফারেন্স লিখুন এবং বুকিং পেজে স্ক্রিনশট দিন।"],
      ["শিশুদের নিয়ে যেতে পারি?", "হ্যাঁ। ৪–১০ বছরের শিশু অর্ধেক দাম, ৪ বছরের নিচে ফ্রি। শিশুরাও কেবিনের জায়গা নেয়।"],
      ["কী সঙ্গে আনতে হবে?", "প্রত্যেক প্রাপ্তবয়স্কের এনআইডি কার্ড (বিদেশিদের পাসপোর্ট)। আইন অনুযায়ী আমরা ওঠার সময় তা লিখে রাখি।"],
    ],
    cancel: "বাতিল করতে হলে কী হবে?",
  },
  reach: { eyebrow: "কীভাবে যাবেন", title: "{place}-এ আমাদের সঙ্গে দেখা করুন", whatsapp: "হোয়াটসঅ্যাপ করুন" },
  footer: { tagline: "কাপ্তাই হ্রদ, রাঙামাটির ভাসমান ভিলা।", terms: "শর্তাবলি" },
  book: {
    title: "তারিখ বাছুন", lead: "আপনি বাছাই করলেই দাম বদলাবে। আমরা নিশ্চিত না করা পর্যন্ত কোনো টাকা দিতে হবে না।",
    available: "খালি", someLeft: "{n}টি কেবিন বাকি", full: "পূর্ণ", closed: "বন্ধ", callUs: "কল করুন",
    pricePer: "জনপ্রতি দাম", pricePerBoat: "পুরো বোটের দাম", cutoff: "যাত্রার {n} দিন আগে অনলাইন বুকিং বন্ধ হয়। এর চেয়ে কাছের তারিখের জন্য কল করুন।",
    yourTrip: "আপনার ট্রিপ", boardTimes: "দুপুর ১টায় ওঠা · পরদিন সকাল ১১টায় ফেরা", pickDate: "ক্যালেন্ডার থেকে তারিখ বাছুন",
    chooseCabins: "কেবিন বাছুন", atLeast2: "কমপক্ষে ২টি", sleeps: "{n} জন", booked: "বুকড", selected: "বাছাই করা", free: "খালি",
    meals: "দলের খাবার", mealsNote: "জনপ্রতি {price}", total: "মোট",
    advance: "পুরো টাকা দিন, অথবা নিশ্চিত হওয়ার পর {pct}% ({amount}) আর বাকিটা যাত্রার ২৪ ঘণ্টা আগে।",
    name: "আপনার নাম", namePh: "এনআইডি অনুযায়ী", mobile: "মোবাইল নম্বর", nid: "এনআইডি নম্বর", nidPh: "১০, ১৩ বা ১৭ সংখ্যা", email: "ইমেইল", optional: "ঐচ্ছিক",
    emailPh: "ইনভয়েসের জন্য", notes: "আর কিছু জানাতে চান?", notesPh: "জন্মদিন, খাবারের পছন্দ…",
    agree: "আমি শর্তাবলিতে রাজি। প্রত্যেক প্রাপ্তবয়স্ক এনআইডি আনবেন।", send: "বুকিং অনুরোধ পাঠান",
    holdNote: "নিশ্চিত করার সময় আমরা {h} ঘণ্টা আপনার কেবিন ধরে রাখি এবং এসএমএসে ইনভয়েস পাঠাই।",
    ok: "ঠিক আছে। অনুরোধ পাঠাতে আপনার তথ্য দিন।", needCabins: "কমপক্ষে ২টি কেবিন বাছুন।",
    tooMany: "{n} জনের জন্য আরও কেবিন লাগবে।", boatCap: "বোটে {n} জন পর্যন্ত থাকা যায়।", needGuests: "বুকিংয়ে কমপক্ষে ২ জন লাগবে।",
    taken: "এইমাত্র অন্য কেউ বুক করেছেন। কাছের খালি তারিখ:", noneSoon: "আগামী ৬০ দিনে নেই। কল করুন।",
    adultsHint: "১১ বছর ও তার বেশি", childrenHint: "৪–১০ বছর, অর্ধেক দাম", infantsHint: "ফ্রি",
  },
  my: {
    ref: "বুকিং {ref}", pending: "আমাদের নিশ্চিতকরণের অপেক্ষায়", awaiting: "অনুমোদিত · পেমেন্টের অপেক্ষায়", submitted: "পেমেন্টের প্রমাণ পেয়েছি",
    balance: "নিশ্চিত · বাকি টাকা দিতে হবে", paid: "নিশ্চিত · পুরো টাকা পরিশোধিত", onboard: "বোটে আছেন", done: "ট্রিপ শেষ", closed: "বন্ধ",
    heldUntil: "নিশ্চিত করা পর্যন্ত {t} পর্যন্ত কেবিন ধরে রাখা আছে। আমরা এসএমএস দেব।", payBy: "{t}-এর মধ্যে টাকা দিন", left: "আর {t} বাকি। এর মধ্যে টাকা না এলে কেবিন ছেড়ে দেওয়া হবে।",
    checking: "আমরা আপনার পেমেন্ট দেখছি। সময়সীমা থেমে আছে।", balanceBy: "বাকি {amount} {t}-এর মধ্যে দিতে হবে।",
    paidMsg: "সব ঠিক আছে। দুপুর ১টায় উঠুন, প্রত্যেক প্রাপ্তবয়স্কের এনআইডি আনুন।",
    steps: ["অনুরোধ", "অনুমোদন", "পেমেন্ট", "নিশ্চিত"],
    howPay: "কীভাবে টাকা দেবেন?", advanceNow: "এখন {pct}% অগ্রিম", restBy: "বাকি {amount} {t}-এর মধ্যে", payFull: "পুরো টাকা", nothingLater: "পরে আর কিছু দিতে হবে না",
    sendTo: "{amount} পাঠান", sendHow: "NPSB, BEFTN বা ব্যাংকে জমা। বিকাশ/নগদ থেকে \"সেন্ড টু ব্যাংক\" ব্যবহার করুন।",
    bank: "ব্যাংক", accountName: "অ্যাকাউন্টের নাম", accountNo: "অ্যাকাউন্ট নম্বর", routing: "রাউটিং নম্বর", copy: "কপি", copied: "কপি হয়েছে",
    noteRef: "ট্রান্সফার নোটে {ref} লিখুন, যাতে আমরা আপনার পেমেন্ট খুঁজে পাই।",
    proofTitle: "টাকা দিয়েছেন? প্রমাণ পাঠান", amountSent: "পাঠানো টাকা", sentAt: "তারিখ ও সময়", txn: "ট্রানজেকশন আইডি", txnPh: "ব্যাংকের এসএমএস থেকে",
    sender: "প্রেরকের নাম", senderPh: "অ্যাকাউন্টের নাম", from: "কোথা থেকে পাঠিয়েছেন", choose: "ব্যাংক বা ওয়ালেট বাছুন", other: "অন্যান্য",
    screenshot: "স্ক্রিনশট দিন", screenshotHint: "JPG, PNG বা PDF · ৫ MB পর্যন্ত", sendProof: "পেমেন্টের প্রমাণ পাঠান", pauseNote: "প্রমাণ পাঠালে আমরা দেখা পর্যন্ত সময়সীমা থেমে থাকে।",
    payments: "আপনার পেমেন্ট", totalL: "মোট", paidL: "পরিশোধিত", dueL: "বাকি", invoice: "ইনভয়েস দেখুন", accepted: "গৃহীত", rejected: "গৃহীত হয়নি", checkingL: "যাচাই চলছে",
    cancel: "বাতিল করতে চান? অনুরোধ পাঠান", cancelReason: "কারণ (ঐচ্ছিক)", cancelSend: "বাতিলের অনুরোধ পাঠান", cancelSent: "বাতিলের অনুরোধ পাঠানো হয়েছে। আমরা কল করব।",
    bring: "যাত্রার দিন প্রত্যেক প্রাপ্তবয়স্কের এনআইডি আনুন।", meeting: "দেখা করার জায়গা: {place}।", proofThanks: "ধন্যবাদ। আমরা পেমেন্ট দেখে এসএমএস দেব।",
    trip: "{cabins} · {guests} · দুপুর ১টায় ওঠা", fullBoat: "পুরো বোট",
  },
  req: {
    title: "অনুরোধ পাঠানো হয়েছে। কেবিন ধরে রাখা আছে।", lead: "কয়েক ঘণ্টার মধ্যে নিশ্চিত করে {mobile} নম্বরে ইনভয়েস পাঠাব।",
    refL: "বুকিং রেফারেন্স", waiting: "আমাদের অপেক্ষায়", heldUntil: "নিশ্চিত করা পর্যন্ত {t} পর্যন্ত ধরে রাখা।",
    next: "এরপর কী হবে", nextSteps: ["আমরা অনুমোদন করে এসএমএসে ইনভয়েস পাঠাব।", "২৪ ঘণ্টার মধ্যে ব্যাংক ট্রান্সফারে দিন। পুরো, বা এখন ৫০%।", "এই পেজে ট্রান্সফারের স্ক্রিনশট দিন।", "দুপুর ১টায় উঠুন। প্রত্যেক প্রাপ্তবয়স্কের এনআইডি আনুন।"],
    save: "এই পেজের লিংক রেখে দিন। এটি শুধু আপনার জন্য।",
  },
};

export const DICT: Record<Lang, Dict> = { en, bn };

/** Fill {placeholders}. */
export const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
