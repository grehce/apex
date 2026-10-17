// Lines on living well from literary greats — all public-domain works (standard English
// translations for Seneca, Marcus Aurelius, Montaigne and Voltaire).
// One is picked on the server per request, so it changes only when the page loads.
const QUOTES: { text: string; who: string; work: string }[] = [
  { text: "I went to the woods because I wished to live deliberately.", who: "Henry David Thoreau", work: "Walden" },
  { text: "Life is long if you know how to use it.", who: "Seneca", work: "On the Shortness of Life" },
  { text: "As is a tale, so is life: not how long it is, but how good it is, is what matters.", who: "Seneca", work: "Letters to Lucilius" },
  { text: "Very little is needed to make a happy life.", who: "Marcus Aurelius", work: "Meditations" },
  { text: "The value of life lies not in the length of days, but in the use we make of them.", who: "Michel de Montaigne", work: "Essays" },
  { text: "We must cultivate our garden.", who: "Voltaire", work: "Candide" },
  { text: "What do we live for, if it is not to make life less difficult to each other?", who: "George Eliot", work: "Middlemarch" },
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
