"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink } from "react-plaid-link";
import { exchangeBody, logLinkEvent } from "@/lib/link-client";

/** Finishes Plaid Link after a bank's own sign-in page (OAuth) sends the user back to Apex. */
export function OAuthResume() {
  const router = useRouter();
  const [saved, setSaved] = useState<{ token: string; itemId: string | null } | null>(null);
  const [status, setStatus] = useState("Finishing your bank connection…");
  const [redirect, setRedirect] = useState<string | undefined>(undefined);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("apex.plaid.link");
      if (raw) setSaved(JSON.parse(raw));
      else setStatus("This connection expired. Start again from Settings.");
    } catch {
      setStatus("This connection expired. Start again from Settings.");
    }
    setRedirect(window.location.href);
  }, []);

  const { open, ready } = usePlaidLink({
    token: saved?.token ?? null,
    receivedRedirectUri: redirect,
    onSuccess: async (publicToken, metadata) => {
      setStatus("Fetching accounts…");
      try {
        const url = saved?.itemId ? "/api/plaid/sync" : "/api/plaid/exchange";
        const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(saved?.itemId ? {} : exchangeBody(publicToken, metadata)) });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `Request failed (${r.status})`);
        try { sessionStorage.removeItem("apex.plaid.link"); } catch { /* ignore */ }
        router.replace("/settings");
        router.refresh();
      } catch (e) {
        setStatus((e as Error).message);
      }
    },
    onExit: (error, metadata) => {
      logLinkEvent(error ? "link_error" : "link_exit", { ...metadata, error });
      try { sessionStorage.removeItem("apex.plaid.link"); } catch { /* ignore */ }
      router.replace("/settings");
    },
  });

  useEffect(() => {
    if (saved && redirect && ready) open();
  }, [saved, redirect, ready, open]);

  return <p className="mono muted" style={{ fontSize: 13 }} role="status">{status}</p>;
}
