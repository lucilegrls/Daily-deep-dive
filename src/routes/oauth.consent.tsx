import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";

type AuthorizationData = {
  authorization_id?: string;
  redirect_url?: string;
  redirect_to?: string;
  redirect_uri?: string;
  scope?: string;
  scopes?: string[];
  client?: { name?: string; client_name?: string; redirect_uri?: string };
};
type OAuthResult = { data: AuthorizationData | null; error: { message: string } | null };
type OAuthApi = {
  getAuthorizationDetails(id: string): Promise<OAuthResult>;
  approveAuthorization(id: string): Promise<OAuthResult>;
  denyAuthorization(id: string): Promise<OAuthResult>;
};

const oauth = (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/oauth/consent")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Connect an assistant — Curiosity, Sourced" },
      {
        name: "description",
        content: "Approve or cancel an assistant's access to your Curiosity, Sourced account.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    authorization_id:
      typeof search["authorization_id"] === "string" ? search["authorization_id"] : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id)
      throw new Error("This connection link is missing its authorization code.");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id") ?? "";
    const result = await oauth.getAuthorizationDetails(authorizationId);
    if (result.error)
      throw new Error(result.error.message || "This connection request is invalid.");
    const immediate = result.data?.redirect_url ?? result.data?.redirect_to;
    if (immediate && !result.data?.client) throw redirect({ href: immediate });
    const { data: session } = await supabase.auth.getSession();
    return { details: result.data, email: session.session?.user.email ?? "" };
  },
  component: ConsentPage,
  pendingComponent: () => (
    <ConsentShell>
      <p className="text-sm text-muted-foreground">Loading the connection request…</p>
    </ConsentShell>
  ),
  errorComponent: ({ error }) => (
    <ConsentShell>
      <h1 className="font-display text-2xl font-semibold text-foreground">
        This connection request could not be loaded
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {error instanceof Error ? error.message : String(error)}
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        Start the connection again from your assistant.
      </p>
    </ConsentShell>
  ),
});

function ConsentShell({ children }: { children: ReactNode }) {
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

function ConsentPage() {
  const { details, email } = Route.useLoaderData();
  const { authorization_id: authorizationId } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const client = details?.client?.name ?? details?.client?.client_name ?? "An assistant";
  const redirectUri = details?.redirect_uri ?? details?.client?.redirect_uri ?? "";
  const scopes: string[] = Array.isArray(details?.scopes)
    ? details.scopes
    : String(details?.scope ?? "")
        .split(/\s+/)
        .filter(Boolean);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const result = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (result.error) {
      setBusy(false);
      setError(result.error.message);
      return;
    }
    const target = result.data?.redirect_url ?? result.data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No return address was provided. Start again from your assistant.");
      return;
    }
    window.location.assign(target);
  }

  return (
    <ConsentShell>
      <h1 className="font-display text-2xl font-semibold text-foreground">
        Connect {client} to Curiosity, Sourced
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {client} will be able to search topics, read approved sources and list your saved topics
        while acting as you.
      </p>
      {email ? <p className="mt-3 text-sm text-foreground">Signed in as {email}</p> : null}
      {redirectUri ? (
        <p className="mt-1 break-all text-xs text-muted-foreground">Returns to {redirectUri}</p>
      ) : null}
      {scopes.length ? (
        <ul className="mt-4 list-disc space-y-1 ps-5 text-sm text-foreground">
          {scopes.map((scope) => (
            <li key={scope}>{SCOPE_LABELS[scope] ?? `Additional permission: ${scope}`}</li>
          ))}
        </ul>
      ) : null}
      <p className="mt-4 text-xs text-muted-foreground">
        All assistant reads remain subject to your existing database permissions.
      </p>
      {error ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="mt-6 flex flex-col gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void decide(true)}
          className="rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void decide(false)}
          className="rounded-full border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground disabled:opacity-60"
        >
          Cancel connection
        </button>
      </div>
    </ConsentShell>
  );
}
