// Apex-side transaction clean-up, applied on top of Plaid's categories when the dashboard is built.
// Pure and deterministic: no network, no database. Plaid's raw data is never modified.
//
// Order of precedence:
//   1. Money moving between the member's own accounts (matched pairs) → TRANSFER_OUT / TRANSFER_IN,
//      or LOAN_PAYMENTS when the receiving account is a card or loan.
//   2. Description rules: income (payroll, EDD, tax refunds), card and loan payments, bank transfers.
//   3. Merchant keywords for purchases Plaid left uncategorized (OTHER or blank).
//   4. A cleaned display name when Plaid had no merchant name.

export type CatTx = {
  id: string;
  accountId?: string;
  date: string; // YYYY-MM-DD
  name: string; // display name (Plaid merchant name, else raw description)
  raw?: string; // raw bank description, when different from name
  category: string; // Plaid personal_finance_category.primary, or ""
  amount: number; // Plaid sign: positive = money out
  pending?: boolean;
};
export type AcctKind = Record<string, string>; // accountId → Plaid type (depository | credit | loan | investment)

const UNCATEGORIZED = new Set(["", "OTHER", "GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE"]);

const INCOME = /\b(EDD|UI DEPOSIT|PAYROLL|DIR(?:ECT)? ?DEP|SALARY|IRS TREAS|TAX REF|SSA TREAS|INTEREST PAID|DIVIDEND)\b/i;
const CARD_PAYMENT = /(APPLECARD|APPLE CARD|AMEX EPAYMENT|AMERICAN EXPRESS.*(PAYMENT|ACH PMT)|CHASE CREDIT CRD|CITI (CARD|AUTOPAY)|CAPITAL ONE.*(PMT|PAYMENT)|DISCOVER.*(PAYMENT|E-PAYMENT)|CRD ?EPAY|CREDIT ?CARD.*PAYMENT|BARCLAYCARD|SYNCHRONY.*PAYMENT|PAYMENT THANK YOU|AUTOPAY PAYMENT|ONLINE PAYMENT.*THANK)/i;
const LOAN_PAYMENT = /(MORTGAGE|MTG PMT|HOME LOAN|LOAN PMT|LOAN PAYMENT|STUDENT LN|NAVIENT|NELNET|SALLIE MAE)/i;
const BANK_TRANSFER = /(ONLINE BANKING TRANSFER|ONLINE TRANSFER|TRANSFER (TO|FROM)\b|INTERNAL TRANSFER|ZELLE|WIRE (TYPE|TRANSFER|IN|OUT)|BOOK TRANSFER|X MONEY)/i;

const MERCHANTS: [RegExp, string][] = [
  [/(DOORDASH|UBER ?EATS|GRUBHUB|CAVIAR|POSTMATES)/i, "FOOD_AND_DRINK"],
  [/(SAFEWAY|TRADER JOE|WHOLE ?FOODS|BERKELEY BOWL|SPROUTS|LUCKY|RAINBOW GROCERY|MONTEREY MARKET|GROCERY|MARKET\b)/i, "FOOD_AND_DRINK"],
  [/(\bTST\*|THAI|NOODLE|RAMEN|SUSHI|PIZZ|TAQUERIA|TACO|BURRITO|BURGER|CAFE|COFFEE|ESPRESSO|STARBUCKS|PEET|BLUE BOTTLE|BAKERY|BAGEL|DELI\b|DINER|GRILL|KITCHEN|BISTRO|RESTAURANT|BRASSERIE|CANTINA|CHIHUA|\bBAR\b|PUB\b|BREW|BOBA|TEA ?HOUSE|DONUT|CHIPOTLE|SWEETGREEN|CAVA\b|MCDONALD|IN-N-OUT)/i, "FOOD_AND_DRINK"],
  [/(UBER(?! ?EATS)|LYFT|WAYMO|\bBART\b|CLIPPER|CALTRAIN|AC TRANSIT|FASTRAK|PARKING|PARKMOBILE|SHELL OIL|CHEVRON|\bARCO\b|\b76\b|VALERO|EXXON|SUPERCHARG|EVGO|CHARGEPOINT|ELECTRIFY AMERICA)/i, "TRANSPORTATION"],
  [/(AIRLINE|UNITED\s?AIR|DELTA AIR|ALASKA AIR|SOUTHWEST|JETBLUE|AMERICAN AIR|AIRBNB|VRBO|HOTEL|MARRIOTT|HILTON|HYATT|EXPEDIA|BOOKING\.COM)/i, "TRAVEL"],
  [/(NETFLIX|SPOTIFY|HULU|DISNEY\+|HBO|MAX\.COM|YOUTUBE|APPLE\.COM\/BILL|AMC |TICKETMASTER|EVENTBRITE|STEAM)/i, "ENTERTAINMENT"],
  [/(PG&E|PGE|EBMUD|COMCAST|XFINITY|SONIC\.NET|AT&T|VERIZON|T-MOBILE|RECOLOGY|WASTE MGMT)/i, "RENT_AND_UTILITIES"],
  [/(KAISER|SUTTER|DENTAL|OPTOM|MEDICAL|CLINIC)/i, "MEDICAL"],
  [/(SALON|BARBER|\bSPA\b|NAIL|GYM|FITNESS|YOGA|PILATES|CLASSPASS|EQUINOX)/i, "PERSONAL_CARE"],
  [/(HOME DEPOT|LOWE'?S|ACE HARDWARE|ORCHARD SUPPLY|IKEA)/i, "HOME_IMPROVEMENT"],
  [/(AMAZON|AMZN|TARGET|WALMART|COSTCO|BEST BUY|APPLE STORE|CRATE|WILLIAMS.SONOMA|NORDSTROM|UNIQLO|ETSY|EBAY)/i, "GENERAL_MERCHANDISE"],
  [/(OVERDRAFT|MONTHLY (MAINTENANCE|SERVICE) FEE|ATM FEE|FOREIGN TRANSACTION FEE)/i, "BANK_FEES"],
];

// Pharmacy chains sell everyday goods; count them as general merchandise even when Plaid says medical.
const PHARMACY = /\b(CVS|WALGREENS|RITE ?AID|DUANE READE)\b/i;
// Card perks paid back as statement credits (e.g. a monthly streaming or Uber credit).
const CARD_CREDIT = /(DIGITAL ENTERTAINMENT CREDIT|ENTERTAINMENT CREDIT|UBER (CASH|ONE)? ?CREDIT|SAKS CREDIT|AIRLINE (FEE )?CREDIT|HOTEL CREDIT|CLEAR (PLUS )?CREDIT|EQUINOX CREDIT|WALMART\+? CREDIT|STATEMENT CREDIT|PLATINUM .*CREDIT|AMEX OFFER|SHOP SMALL CREDIT)/i;

const CITIES = ["SAN FRANCISCO", "SOUTH SAN FRANCISCO", "BERKELEY", "OAKLAND", "EMERYVILLE", "ALBANY", "EL CERRITO", "RICHMOND", "ALAMEDA", "SAN JOSE", "SANTA CLARA", "SUNNYVALE", "MOUNTAIN VIEW", "PALO ALTO", "MENLO PARK", "REDWOOD CITY", "SAN MATEO", "DALY CITY", "WALNUT CREEK", "LOS ANGELES", "NEW YORK", "SEATTLE"];
const KNOWN_NAMES: [RegExp, string][] = [
  [/APPLECARD|APPLE CARD/i, "Apple Card payment"],
  [/CALIFORNIA EDD|\bEDD\b/i, "California EDD"],
  [/AMEX EPAYMENT|AMERICAN EXPRESS/i, "American Express"],
  [/D ?J ?\*? ?WSJ|WALL ?ST(REET)? ?JOURNAL/i, "Wall Street Journal"],
  [/\bCVS\b/i, "CVS"],
  [/\bWALGREENS\b/i, "Walgreens"],
  [/ACE ?HARDWARE/i, "Ace Hardware"],
  [/\bPG&E\b|\bPGE\b/i, "PG&E"],
  [/\bEBMUD\b/i, "EBMUD"],
];

const title = (s: string) => s.toLowerCase().replace(/(^|[\s\-/(&.])([a-z])/g, (_, p, c) => p + c.toUpperCase()).replace(/\b(Ca|Ny|Llc|Inc|Ach)\b/g, (w) => w.toUpperCase());
// Raw bank text is shouty and noisy; merchant names from Plaid ("Trader Joe's") are already fine.
const looksRaw = (s: string) => s === s.toUpperCase() || /(DES:|INDN:|X{4}|\b\d{4,}\b|\bPPD\b|\bAPLPAY\b)/i.test(s);
const PREFIX = /^(APLPAY|APPLE PAY|GOOGLE PAY|GPAY)\s+/i;
const NOISE = /\s*(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}|\b(PPD|CCD|WEB|ACH)\b)/gi;

/** Turn a raw bank description into a short merchant name. Keeps the original when unsure. */
export function cleanName(raw: string): string {
  const original = raw.trim();
  for (const [re, name] of KNOWN_NAMES) if (re.test(original)) return name;
  if (!looksRaw(original)) {
    const light = original.replace(PREFIX, "").replace(NOISE, "").replace(/\s{2,}/g, " ").trim();
    return light.length >= 2 ? light : original;
  }
  let s = original.replace(PREFIX, "").replace(NOISE, " ").replace(/\s#\s?\d+\b/g, " ");
  const refund = /^PURCHASE REFUND\b/i.test(s) || /\bREFUND\b/i.test(s);
  s = s.replace(/\bINDN:.*$/i, "").replace(/\bDES:.*$/i, "").replace(/\bID:\s*\S+/gi, "").replace(/\bCO ID:.*$/i, "");
  s = s.replace(/^(MOBILE PURCHASE|PURCHASE REFUND|CHECKCARD|CHECK CARD|POS PURCHASE|POS DEBIT|DEBIT CARD PURCHASE|PURCHASE|RECURRING PAYMENT)\s+/i, "");
  s = s.replace(/^\d{4}\s+/, ""); // card-swipe date, e.g. "1017 "
  s = s.replace(/\b(TST\*|SQ ?\*|SP ?\*|PAYPAL ?\*|PY ?\*)\s*/gi, "");
  s = s.replace(/\s+X{3,}\S*.*$/i, ""); // masked card numbers and anything after
  s = s.replace(/\s+\d{6,}.*$/, "");
  // Trailing "CITY ST" (also glued, e.g. "San FranciscoCA").
  s = s.replace(/([a-z])(CA|NY|WA|OR|TX|NV|AZ|MA|IL|FL|CO|HI)$/, "$1");
  s = s.replace(/\s*\b([A-Z]{2})\s*$/i, (m, st) => (/^(CA|NY|WA|OR|TX|NV|AZ|MA|IL|FL|CO|HI)$/i.test(st) ? "" : m)).trim();
  for (const c of CITIES) { const re = new RegExp(`\\s*${c.replace(/ /g, "\\s?")}$`, "i"); if (re.test(s)) { s = s.replace(re, ""); break; } }
  s = s.replace(/^\d+\s+(?=[A-Z])/i, "").replace(/\s{2,}/g, " ").replace(/[\s,*#-]+$/, "").trim();
  if (s.length < 2) return original;
  const name = title(s);
  return refund ? `Refund · ${name}` : name;
}

function merchantCategory(text: string): string | null {
  for (const [re, cat] of MERCHANTS) if (re.test(text)) return cat;
  return null;
}

/** Own-account pairs: an outflow and an inflow of the same amount on two different accounts within 3 days. */
function matchOwnTransfers(txs: CatTx[]): Map<string, { counterpart: string; to: string }> {
  const out = new Map<string, { counterpart: string; to: string }>();
  const posted = txs.filter((t) => t.accountId && Math.abs(t.amount) >= 1);
  const inflows = posted.filter((t) => t.amount < 0);
  const used = new Set<string>();
  const day = (d: string) => Date.parse(d + "T00:00:00Z") / 86400000;
  for (const o of posted.filter((t) => t.amount > 0).sort((a, b) => b.amount - a.amount)) {
    if (INCOME.test(o.raw ?? o.name)) continue;
    const cents = Math.round(o.amount * 100);
    const match = inflows
      .filter((i) => !used.has(i.id) && i.accountId !== o.accountId && Math.round(-i.amount * 100) === cents && Math.abs(day(i.date) - day(o.date)) <= 3 && !INCOME.test(i.raw ?? i.name))
      .sort((a, b) => Math.abs(day(a.date) - day(o.date)) - Math.abs(day(b.date) - day(o.date)))[0];
    if (!match) continue;
    used.add(match.id);
    out.set(o.id, { counterpart: match.id, to: match.accountId! });
    out.set(match.id, { counterpart: o.id, to: match.accountId! });
  }
  return out;
}

/** Re-categorize and clean names. Returns new rows; input is not mutated. */
export function categorizeTransactions<T extends CatTx>(txs: T[], kinds: AcctKind = {}, subtypes: Record<string, string | null> = {}): T[] {
  const pairs = matchOwnTransfers(txs);
  const first = txs.map((t) => {
    const text = `${t.raw ?? ""} ${t.name}`;
    let category = t.category ?? "";
    const pair = pairs.get(t.id);
    const debtSide = (id: string | undefined) => (id ? kinds[id] === "credit" || kinds[id] === "loan" : false);
    if (pair) {
      category = debtSide(pair.to) ? "LOAN_PAYMENTS" : t.amount > 0 ? "TRANSFER_OUT" : "TRANSFER_IN";
    } else if (t.amount < 0 && debtSide(t.accountId) && CARD_CREDIT.test(text)) {
      category = "CARD_CREDITS";
    } else if (PHARMACY.test(text) && category !== "TRANSFER_IN" && category !== "TRANSFER_OUT") {
      category = "GENERAL_MERCHANDISE";
    } else if (t.amount < 0 && INCOME.test(text) && kinds[t.accountId ?? ""] !== "credit") {
      category = "INCOME";
    } else if (t.amount > 0 && CARD_PAYMENT.test(text)) {
      category = "LOAN_PAYMENTS";
    } else if (t.amount < 0 && debtSide(t.accountId) && /PAYMENT|THANK YOU|AUTOPAY/i.test(text)) {
      category = "LOAN_PAYMENTS"; // payment received on a card or loan
    } else if (t.amount > 0 && LOAN_PAYMENT.test(text) && UNCATEGORIZED.has(category)) {
      category = "LOAN_PAYMENTS";
    } else if (UNCATEGORIZED.has(category) && BANK_TRANSFER.test(text)) {
      category = t.amount > 0 ? "TRANSFER_OUT" : "TRANSFER_IN";
    } else if (UNCATEGORIZED.has(category)) {
      category = merchantCategory(text) ?? category;
    }
    const raw = t.raw ?? t.name;
    let name = cleanName(t.raw && t.raw !== t.name ? t.name : raw);
    if (pair && subtypes[pair.to] === "mortgage") name = "Mortgage payment";
    return { ...t, category, name };
  });

  // Refunds and merchant credits take the category of the purchase they reverse (same merchant,
  // within 60 days), so a $9.99 credit from a merchant offsets that merchant's $9.99 charge.
  const day = (d: string) => Date.parse(d + "T00:00:00Z") / 86400000;
  const SETTLED = new Set(["INCOME", "LOAN_PAYMENTS", "TRANSFER_IN", "TRANSFER_OUT", "CARD_CREDITS"]);
  const purchases = first.filter((t) => t.amount > 0 && !SETTLED.has(t.category));
  const key = (n: string) => n.replace(/^Refund · /, "").toLowerCase();
  return first.map((t) => {
    if (t.amount >= 0 || SETTLED.has(t.category) || pairs.has(t.id)) return t;
    const match = purchases
      .filter((p) => key(p.name) === key(t.name) && Math.abs(day(p.date) - day(t.date)) <= 60)
      .sort((a, b) => (Math.round(a.amount * 100) === Math.round(-t.amount * 100) ? -1 : 0) - (Math.round(b.amount * 100) === Math.round(-t.amount * 100) ? -1 : 0) || Math.abs(day(a.date) - day(t.date)) - Math.abs(day(b.date) - day(t.date)))[0];
    return match && match.category !== t.category ? { ...t, category: match.category } : t;
  });
}
