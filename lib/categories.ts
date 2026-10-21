// Display names and icons for spending categories (Plaid personal_finance_category.primary, plus Apex's own).
// Pure data; the icons are drawn by components/CategoryIcon.tsx.

export type IconKey = "food" | "bag" | "wrench" | "bolt" | "car" | "plane" | "ticket" | "cross" | "sparkle" | "hammer" | "house" | "receipt" | "landmark" | "card" | "in" | "out" | "swap" | "dots" | "dot";

const META: Record<string, { label: string; icon: IconKey }> = {
  FOOD_AND_DRINK: { label: "Food & drink", icon: "food" },
  GENERAL_MERCHANDISE: { label: "Shopping", icon: "bag" },
  GENERAL_SERVICES: { label: "Services", icon: "wrench" },
  RENT_AND_UTILITIES: { label: "Rent & utilities", icon: "bolt" },
  TRANSPORTATION: { label: "Transportation", icon: "car" },
  TRAVEL: { label: "Travel", icon: "plane" },
  ENTERTAINMENT: { label: "Entertainment", icon: "ticket" },
  MEDICAL: { label: "Medical", icon: "cross" },
  PERSONAL_CARE: { label: "Personal care", icon: "sparkle" },
  HOME_IMPROVEMENT: { label: "Home & garden", icon: "hammer" },
  MORTGAGE: { label: "Mortgage", icon: "house" },
  BANK_FEES: { label: "Bank fees", icon: "receipt" },
  GOVERNMENT_AND_NON_PROFIT: { label: "Taxes, gov't & giving", icon: "landmark" },
  CARD_CREDITS: { label: "Card credits", icon: "card" },
  LOAN_PAYMENTS: { label: "Loan & card payments", icon: "card" },
  INCOME: { label: "Income", icon: "in" },
  TRANSFER_IN: { label: "Transfer in", icon: "in" },
  TRANSFER_OUT: { label: "Transfer out", icon: "out" },
  OTHER: { label: "Uncategorized", icon: "dot" },
};

const BY_LABEL = new Map(Object.values(META).map((m) => [m.label.toLowerCase(), m.icon]));

export function categoryLabel(raw: string | null | undefined): string {
  if (!raw) return "Uncategorized";
  return META[raw]?.label ?? raw.charAt(0) + raw.slice(1).toLowerCase().replace(/_/g, " ");
}

/** Icon for a category, by raw key or by display label ("Everything else" → dots). */
export function categoryIcon(nameOrRaw: string): IconKey {
  if (META[nameOrRaw]) return META[nameOrRaw].icon;
  if (nameOrRaw === "Everything else") return "dots";
  return BY_LABEL.get(nameOrRaw.toLowerCase()) ?? "dot";
}
