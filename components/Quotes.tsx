// Original lines (not attributed quotes), so nothing here is misattributed or borrowed.
// Picked on the server per request, so a new line appears only when the page loads.
const LINES = [
  "Small, boring, consistent. That's the whole trick.",
  "Every dollar you don't need today is a gift to future you.",
  "Spend on what you love. Cut what you won't remember.",
  "Compound interest rewards the patient and the stubborn.",
  "A budget is just a plan for saying yes on purpose.",
  "Wealth is mostly options. Keep building yours.",
  "The best financial move is often the quiet one.",
  "You don't have to be rich to be intentional.",
  "Progress, not perfection — check in, adjust, keep going.",
  "Time in the market is a kindness to your later self.",
];

export function Quotes() {
  const line = LINES[Math.floor(Math.random() * LINES.length)];
  return <em style={{ fontFamily: "var(--sans)" }}>{line}</em>;
}
