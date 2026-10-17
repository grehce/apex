// Money lines from literary greats — all public-domain works, wording checked against sources.
// One is picked on the server per request, so it changes only when the page loads.
const QUOTES: { text: string; who: string; work: string }[] = [
  { text: "A man is rich in proportion to the number of things he can afford to let alone.", who: "Henry David Thoreau", work: "Walden" },
  { text: "It is not the man who has too little, but the man who craves more, that is poor.", who: "Seneca", work: "Letters to Lucilius" },
  { text: "Beware of little expenses; a small leak will sink a great ship.", who: "Benjamin Franklin", work: "The Way to Wealth" },
  { text: "Neither a borrower nor a lender be.", who: "William Shakespeare", work: "Hamlet" },
  { text: "A large income is the best recipe for happiness I ever heard of.", who: "Jane Austen", work: "Mansfield Park" },
  { text: "Annual income twenty pounds, annual expenditure nineteen nineteen and six, result happiness.", who: "Charles Dickens", work: "David Copperfield" },
];

export function Quotes() {
  const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  return (
    <span style={{ fontFamily: "var(--sans)", textAlign: "right", maxWidth: 560 }}>
      <em>{q.text}</em>
      <span className="mono" style={{ fontSize: 11, marginLeft: 8, whiteSpace: "nowrap" }}>— {q.who}, <em>{q.work}</em></span>
    </span>
  );
}
