// Small monochrome line icons for spending categories. 16×16, stroke = currentColor.
import { categoryIcon, type IconKey } from "@/lib/categories";

const PATHS: Record<IconKey, string> = {
  food: "M3.5 2v4a2 2 0 0 0 4 0V2M5.5 2v12M11.5 14V2c1.4.8 2 2.6 2 5.5h-2",
  bag: "M3 5h10l-1 9H4L3 5zM6 5V4a2 2 0 0 1 4 0v1",
  wrench: "M10.5 2.5a3 3 0 0 0-3.7 3.9L2.5 10.7a1.4 1.4 0 0 0 2 2l4.3-4.3a3 3 0 0 0 3.9-3.7l-1.8 1.8-1.6-.4-.4-1.6 1.6-1.9z",
  bolt: "M9 1.5 3.5 9H8l-1 5.5L12.5 7H8l1-5.5z",
  car: "M2.5 10.5v-2l1.4-3.3A1.5 1.5 0 0 1 5.3 4.3h5.4a1.5 1.5 0 0 1 1.4.9l1.4 3.3v2M2.5 10.5h11v2h-2v-1h-7v1h-2v-2zM4.5 8.5h.01M11.5 8.5h.01",
  plane: "M14 2 2 7l4.5 1.5M14 2l-4 12-2.5-4.5M14 2 6.5 8.5v4l2-2.5",
  ticket: "M2 5.5V4h12v1.5a1.5 1.5 0 0 0 0 3V10H2V8.5a1.5 1.5 0 0 0 0-3zM9.5 4v6",
  cross: "M6 2.5h4v3.5h3.5v4H10v3.5H6V10H2.5V6H6V2.5z",
  sparkle: "M8 1.5 9.3 6.7 14.5 8 9.3 9.3 8 14.5 6.7 9.3 1.5 8 6.7 6.7 8 1.5z",
  hammer: "M9 2.5 13.5 7l-1.5 1.5-1.5-1.5-6.5 6.5-2-2 6.5-6.5L7 3.5 8.5 2l.5.5z",
  house: "M2.5 7.5 8 3l5.5 4.5M4 6.5V13h3v-3.5h2V13h3V6.5",
  receipt: "M4 1.5h8v13l-2-1.2-2 1.2-2-1.2-2 1.2v-13zM6 5h4M6 7.5h4M6 10h2",
  landmark: "M2 6 8 2.5 14 6M3 6.5v6M6.3 6.5v6M9.7 6.5v6M13 6.5v6M2 13.5h12",
  card: "M2 4h12v8H2V4zM2 6.5h12M4.5 10H7",
  in: "M8 2.5v9M4.5 8 8 11.5 11.5 8M3 13.5h10",
  out: "M8 11.5v-9M4.5 6 8 2.5 11.5 6M3 13.5h10",
  swap: "M3 5.5h9l-2.5-2.5M13 10.5H4l2.5 2.5",
  dots: "M4 8h.01M8 8h.01M12 8h.01",
  dot: "M8 8h.01",
};

export function CategoryIcon({ name, size = 16 }: { name: string; size?: number }) {
  const key = categoryIcon(name);
  const heavy = key === "dots" || key === "dot";
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={heavy ? 2.6 : 1.3} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", display: "block" }}>
      <path d={PATHS[key]} />
    </svg>
  );
}
