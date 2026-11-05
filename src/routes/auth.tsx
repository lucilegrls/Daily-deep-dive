import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { friendlyError } from "@/lib/friendly-error";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/lib/account";
import { useI18n } from "@/lib/i18n";
import { oauthReturnPath } from "@/lib/oauth-return-path";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { next?: string } =>
    typeof s["next"] === "string" ? { next: s["next"] } : {},
  head: () => ({
    meta: [
      { title: "Join Curiosity, Sourced — keep your streak and ranking" },
      {
        name: "description",
        content:
          "Create a free account to pick the subjects you love, keep a daily reading streak, and climb the weekly ranking of the most curious readers.",
      },
      { property: "og:title", content: "Join Curiosity, Sourced" },
      {
        property: "og:description",
        content:
          "Pick your subjects, keep a daily reading streak, and climb the weekly ranking.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { session, profile } = useAccount();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { next: rawNext } = Route.useSearch();
  const next = rawNext ? oauthReturnPath(rawNext) : null;
  const returnUrl = () => (next ? new URL(next, window.location.origin).href : window.location.origin);
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    if (next) {
      window.location.assign(next);
      return;
    }
    void navigate({
      to: profile && profile.onboarded ? "/" : "/welcome",
      replace: true,
    });
  }, [session, profile, navigate, next]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: returnUrl(),
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setMessage(t("auth.confirmSent"));
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      }
    } catch (err) {
      setError(friendlyError(err, t("auth.error"), t));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: returnUrl(),
      },
    });
    if (oauthError) {
      setError(t("auth.googleError"));
    }
  };

  return (
    <div className="paper-grain flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <div className="letter-sheet w-full max-w-md rounded-2xl px-7 py-9">
        <p className="eyebrow text-center text-muted-foreground">
          {mode === "signup" ? t("auth.eyebrowSignup") : t("auth.eyebrowSignin")}
        </p>
        <h1 className="mt-3 text-center font-display text-3xl font-semibold text-foreground">
          Curiosity, Sourced
        </h1>
        <div className="rule-diamond ornamental mx-auto mt-5 max-w-[12rem]" aria-hidden="true" />
        <p className="mt-5 text-center text-sm leading-relaxed text-muted-foreground">
          {t("auth.intro")}
        </p>

        <button
          type="button"
          onClick={() => void google()}
          className="mt-7 flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary/50"
        >
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9Z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.1-4 1.1-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z"
            />
            <path
              fill="#FBBC05"
              d="M5.4 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.4a12 12 0 0 0 0 10.8l4-3.1Z"
            />
            <path
              fill="#EA4335"
              d="M12 4.7c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.7 12 4.7Z"
            />
          </svg>
          {t("auth.google")}
        </button>

        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          {t("auth.or")}
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" ? (
            <Field
              label={t("auth.nameLabel")}
              value={displayName}
              onChange={setDisplayName}
              placeholder={t("auth.namePlaceholder")}
              type="text"
            />
          ) : null}
          <Field
            label={t("auth.email")}
            value={email}
            onChange={setEmail}
            placeholder={t("auth.emailPlaceholder")}
            type="email"
            required
          />
          <Field
            label={t("auth.password")}
            value={password}
            onChange={setPassword}
            placeholder={t("auth.passwordPlaceholder")}
            type="password"
            required
          />

          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
          {message ? (
            <p className="text-sm text-foreground">{message}</p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy
              ? t("auth.busy")
              : mode === "signup"
                ? t("auth.create")
                : t("auth.signIn")}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          {mode === "signup" ? t("auth.haveAccount") : t("auth.newHere")}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signup" ? "signin" : "signup");
              setError(null);
              setMessage(null);
            }}
            className="text-foreground underline decoration-gold underline-offset-4"
          >
            {mode === "signup" ? t("auth.toSignIn") : t("auth.toSignUp")}
          </button>
        </p>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="underline underline-offset-4">
            {t("auth.keepReading")}
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="eyebrow text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-lg border border-input bg-card px-3 py-2.5 text-[0.95rem] text-foreground placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none"
      />
    </label>
  );
}
