import { OAuthResume } from "./OAuthResume";

export const metadata = { title: "Connecting…" };

export default function OAuthPage() {
  return (
    <main style={{ minHeight: "60vh", display: "grid", placeItems: "center", padding: 24 }}>
      <OAuthResume />
    </main>
  );
}
