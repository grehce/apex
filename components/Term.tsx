"use client";
/** A jargon word with a plain-language definition on hover, focus or tap. */
export const GLOSSARY = {
  drift: "How far your mix has wandered from your target. Stocks at 83% with a 75% target is +8% drift.",
  target: "The mix you're aiming for, like 75% stocks and 15% bonds.",
  rebalance: "Buying and selling to bring your mix back to its target.",
  "taxable gains": "Profit you lock in by selling at a gain in a regular brokerage account. It's taxed that year.",
  "tax-advantaged": "Accounts like a 401(k) or IRA. Trades inside them don't create a tax bill.",
  "off target after": "The biggest gap between your mix and your target once the plan is done.",
} as const;

export function Term({ k, children, align = "left" }: { k: keyof typeof GLOSSARY; children?: React.ReactNode; align?: "left" | "right" }) {
  return (
    <span className="term" tabIndex={0} aria-label={`${typeof children === "string" ? children : k}: ${GLOSSARY[k]}`}>
      {children ?? k}
      <span role="tooltip" className={`term-tip ${align === "right" ? "term-tip-r" : ""}`} aria-hidden="true">{GLOSSARY[k]}</span>
    </span>
  );
}
