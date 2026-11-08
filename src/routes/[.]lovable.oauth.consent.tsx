import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";

type OAuthResult = { data: any; error: { message: string } | null };
const oauth = (supabase.auth as unknown as {
  oauth: {
    getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
    approveAuthorization: (id: string) => Promise<OAuthResult>;
    denyAuthorization: (id: string) => Promise<OAuthResult>;
  };
}).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  // SSR has no localStorage session and would redirect signed-in users.
  ssr: false,
  head: () => ({
    meta: [
      { title: "Connect an assistant — Curiosity, Sourced" },
      { name: "description", content: "Approve or cancel an assistant's access to your Curiosity, Sourced account." },
      { property: "og:title", content: "Connect an assistant — Curiosity, Sourced" },
      { property: "og:description", content: "Approve or cancel an assistant's access to your account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s["authorization_id"] === "string" ? s["authorization_id"] : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("This connection link is missing its authorization code.");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/auth", search: { next } });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message || "This connection request has expired or is invalid.");
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    const { data: s } = await supabase.auth.getSession();
    return { details: data, email: s.session?.user.email ?? "" };
  },
  component: Consent,
  pendingComponent: () => (
    <Shell><p className="text-sm text-muted-foreground">Loading the connection request…</p></Shell>
  ),
  errorComponent: ({ error }) => (
    <Shell>
      <h1 className="font-display text-2xl font-semibold text-foreground">This connection request could not be loaded</h1>
      <p className="mt-3 text-sm text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p>
      <p className="mt-3 text-sm text-muted-foreground">Start the connection again from your assistant.</p>
    </Shell>
  ),
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="paper-grain flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <div className="letter-sheet w-full max-w-md rounded-2xl px-7 py-9">{children}</div>
    </main>
  );
}

const SCOPE_LABELS: Record<string, string> = {
  openid: "Confirm who you are",
  email: "Share your email address",
  profile: "Share your basic profile",
};

function Consent() {
  const { details, email } = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const client = details?.client?.name ?? details?.client?.client_name ?? "An assistant";
  const redirectUri: string = details?.redirect_uri ?? details?.client?.redirect_uri ?? "";
  const scopes = String(details?.scope ?? details?.scopes ?? "").split(/[\s,]+/).filter(Boolean);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorization_id)
      : await oauth.denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(approve ? `Approval failed: ${error.message}` : `Cancelling failed: ${error.message}`);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No return address was provided. Please start again from your assistant.");
      return;
    }
    window.location.href = target;
  }

  return (
    <Shell>
      <h1 className="font-display text-2xl font-semibold text-foreground">Connect {client} to Curiosity, Sourced</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {client} will be able to search topics, read their sources and list your saved topics while acting as you.
      </p>
      {email ? <p className="mt-3 text-sm text-foreground">Signed in as {email}</p> : null}
      {redirectUri ? <p className="mt-1 break-all text-xs text-muted-foreground">Returns to {redirectUri}</p> : null}
      {scopes.length ? (
        <ul className="mt-4 list-disc space-y-1 ps-5 text-sm text-foreground">
          {scopes.map((s) => <li key={s}>{SCOPE_LABELS[s] ?? `Additional permission requested: ${s}`}</li>)}
        </ul>
      ) : null}
      <p className="mt-4 text-xs text-muted-foreground">This does not bypass this app's permissions or privacy rules.</p>
      {error ? <p role="alert" className="mt-4 text-sm text-destructive">{error}</p> : null}
      <div className="mt-6 flex flex-col gap-2">
        <button type="button" disabled={busy} onClick={() => void decide(true)} className="rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60">Approve</button>
        <button type="button" disabled={busy} onClick={() => void decide(false)} className="rounded-full border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground disabled:opacity-60">Cancel connection</button>
      </div>
    </Shell>
  );
}
