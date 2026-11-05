import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_FEED_MIX,
  clearDraft,
  isFeedMix,
  readDraft,
  type FeedMix,
} from "@/lib/onboarding";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  applyTheme,
  isTheme,
} from "@/lib/themes";

export interface Profile {
  id: string;
  display_name: string;
  theme: string;
  onboarded: boolean;
  feed_mix: FeedMix;
}

export type OnboardingResult = {
  ok: boolean;
  reason: "ok" | "too_few_interests" | "already_onboarded" | "signed_out" | "error";
};

export interface Streak {

  current: number;
  best: number;
  total: number;
}

interface AccountValue {
  session: Session | null;
  loading: boolean;
  profile: Profile | null;
  interests: string[];
  feedMix: FeedMix;
  readTopicIds: number[];
  streak: Streak;
  theme: string;
  setTheme: (theme: string) => void;
  previewTheme: (theme: string) => void;
  saveInterests: (subjects: string[]) => Promise<void>;
  setDisplayName: (name: string) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  applyOnboarding: (choices: {
    interests: string[];
    feedMix: FeedMix;
    theme: string;
    force?: boolean;
  }) => Promise<OnboardingResult>;

  recordRead: (topicId: number) => void;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}


const EMPTY_STREAK: Streak = { current: 0, best: 0, total: 0 };

const AccountContext = createContext<AccountValue | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [readTopicIds, setReadTopicIds] = useState<number[]>([]);
  const [streak, setStreak] = useState<Streak>(EMPTY_STREAK);
  const [theme, setThemeState] = useState<string>(DEFAULT_THEME);

  // Local theme for signed-out visitors
  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    const next = isTheme(stored) ? stored : DEFAULT_THEME;
    setThemeState(next);
    applyTheme(next);
  }, []);

  const loadAccount = useCallback(async (userId: string) => {
    const [profileRes, interestRes, readsRes, streakRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name, theme, onboarded, feed_mix")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("user_interests").select("subject").eq("user_id", userId),
      supabase.from("topic_reads").select("topic_id").eq("user_id", userId),
      supabase.rpc("my_streak", { _tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" }),
    ]);

    let loadedProfile = profileRes.data
      ? ({
          ...profileRes.data,
          feed_mix: isFeedMix(profileRes.data.feed_mix)
            ? profileRes.data.feed_mix
            : DEFAULT_FEED_MIX,
        } as Profile)
      : null;
    let loadedInterests = (interestRes.data ?? []).map((r) => r.subject);

    // A pending journey draft is applied ONCE, and only to an account that has
    // not been onboarded yet. An established reader signing in on a browser
    // that still holds a draft never has their preferences overwritten — the
    // stale draft is dropped before it can reach any account.
    if (loadedProfile?.onboarded) {
      clearDraft();
    } else if (loadedProfile) {
      const draft = readDraft();
      if (draft) {
        const { data: applied, error } = await supabase.rpc("apply_onboarding", {
          _interests: draft.interests,
          _feed_mix: draft.feedMix,
          _theme: draft.theme,
          _force: false,
        });
        const row = Array.isArray(applied) ? applied[0] : null;
        if (!error && row?.applied) {
          clearDraft();
          loadedProfile = {
            ...loadedProfile,
            onboarded: true,
            feed_mix: draft.feedMix,
            theme: isTheme(draft.theme) ? draft.theme : loadedProfile.theme,
          };
          loadedInterests = draft.interests;
        } else if (!error && row && !row.applied) {
          // Rejected server-side (already set up, or too few real subjects):
          // the draft cannot be used, so it does not linger for another account.
          clearDraft();
        }
      }
    }


    if (loadedProfile) {
      setProfile(loadedProfile);
      if (isTheme(loadedProfile.theme)) {
        setThemeState(loadedProfile.theme);
        applyTheme(loadedProfile.theme);
      }
    }
    setInterests(loadedInterests);
    setReadTopicIds([
      ...new Set((readsRes.data ?? []).map((r) => r.topic_id as number)),
    ]);
    const row = Array.isArray(streakRes.data) ? streakRes.data[0] : null;
    setStreak(
      row
        ? {
            current: row.current_streak ?? 0,
            best: row.best_streak ?? 0,
            total: Number(row.total_reads ?? 0),
          }
        : EMPTY_STREAK,
    );
  }, []);


  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    if (data.session?.user) {
      await loadAccount(data.session.user.id);
    }
  }, [loadAccount]);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
      if (data.session?.user) void loadAccount(data.session.user.id);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (
        event !== "SIGNED_IN" &&
        event !== "SIGNED_OUT" &&
        event !== "USER_UPDATED"
      ) {
        return;
      }
      setSession(next);
      if (next?.user) {
        void loadAccount(next.user.id);
      } else {
        setProfile(null);
        setInterests([]);
        setReadTopicIds([]);
        setStreak(EMPTY_STREAK);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadAccount]);

  /** Local-only look change: no database write, used for live previews. */
  const previewTheme = useCallback((next: string) => {
    if (!isTheme(next)) return;
    setThemeState(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // storage unavailable
    }
  }, []);

  const setTheme = useCallback(
    (next: string) => {
      if (!isTheme(next)) return;
      previewTheme(next);
      const userId = session?.user.id;
      if (userId) {
        void supabase.from("profiles").update({ theme: next }).eq("id", userId);
        setProfile((p) => (p ? { ...p, theme: next } : p));
      }
    },
    [session, previewTheme],
  );


  const saveInterests = useCallback(
    async (subjects: string[]) => {
      const userId = session?.user.id;
      if (!userId) return;
      await supabase.from("user_interests").delete().eq("user_id", userId);
      if (subjects.length > 0) {
        await supabase
          .from("user_interests")
          .insert(subjects.map((subject) => ({ user_id: userId, subject })));
      }
      setInterests(subjects);
    },
    [session],
  );

  const setDisplayName = useCallback(
    async (name: string) => {
      const userId = session?.user.id;
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: name })
        .eq("id", userId);
      // Surface failures honestly: local state only follows a real write.
      if (error) throw new Error(error.message);
      setProfile((p) => (p ? { ...p, display_name: name } : p));
    },
    [session],
  );

  const completeOnboarding = useCallback(async () => {
    const userId = session?.user.id;
    if (!userId) return;
    await supabase.from("profiles").update({ onboarded: true }).eq("id", userId);
    setProfile((p) => (p ? { ...p, onboarded: true } : p));
  }, [session]);

  /**
   * One server-authorised, idempotent write for the whole guided journey.
   * `force` is only set by the explicit "Tune my interests" edit mode.
   * The server has the last word on the minimum number of real subjects and
   * on which look ids exist; nothing is written when it refuses.
   */
  const applyOnboarding = useCallback(
    async ({
      interests: picked,
      feedMix,
      theme: nextTheme,
      force = false,
    }: {
      interests: string[];
      feedMix: FeedMix;
      theme: string;
      force?: boolean;
    }): Promise<OnboardingResult> => {
      const userId = session?.user.id;
      if (!userId) return { ok: false, reason: "signed_out" };
      const { data, error } = await supabase.rpc("apply_onboarding", {
        _interests: picked,
        _feed_mix: feedMix,
        _theme: isTheme(nextTheme) ? nextTheme : "",
        _force: force,
      });
      const row = Array.isArray(data) ? data[0] : null;
      if (error || !row?.applied) {
        const reason = row?.reason;
        return {
          ok: false,
          reason:
            reason === "too_few_interests" || reason === "already_onboarded"
              ? reason
              : "error",
        };
      }
      clearDraft();
      setInterests(picked);
      setProfile((p) =>
        p
          ? {
              ...p,
              onboarded: true,
              feed_mix: feedMix,
              theme: isTheme(nextTheme) ? nextTheme : p.theme,
            }
          : p,
      );
      if (isTheme(nextTheme)) {
        setThemeState(nextTheme);
        applyTheme(nextTheme);
      }
      return { ok: true, reason: "ok" };
    },
    [session],
  );




  const recordRead = useCallback(
    (topicId: number) => {
      const userId = session?.user.id;
      if (!userId) return;
      void supabase
        .from("topic_reads")
        .insert({ user_id: userId, topic_id: topicId })
        .then(async ({ error }) => {
          if (error && error.code !== "23505") return;
          setReadTopicIds((prev) =>
            prev.includes(topicId) ? prev : [...prev, topicId],
          );
          if (!error) {
            const { data } = await supabase.rpc("my_streak", { _tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" });
            const row = Array.isArray(data) ? data[0] : null;
            if (row) {
              setStreak({
                current: row.current_streak ?? 0,
                best: row.best_streak ?? 0,
                total: Number(row.total_reads ?? 0),
              });
            }
          }
        });
    },
    [session],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setInterests([]);
    setReadTopicIds([]);
    setStreak(EMPTY_STREAK);
  }, []);

  const feedMix: FeedMix = profile?.feed_mix ?? DEFAULT_FEED_MIX;

  const value = useMemo<AccountValue>(
    () => ({
      session,
      loading,
      profile,
      interests,
      feedMix,
      readTopicIds,
      streak,
      theme,
      setTheme,
      previewTheme,


      saveInterests,
      setDisplayName,
      completeOnboarding,
      applyOnboarding,
      recordRead,
      signOut,
      refresh,
    }),
    [
      session,
      loading,
      profile,
      interests,
      feedMix,
      readTopicIds,
      streak,
      theme,
      setTheme,
      previewTheme,

      saveInterests,
      setDisplayName,
      completeOnboarding,
      applyOnboarding,
      recordRead,
      signOut,
      refresh,
    ],
  );


  return (
    <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
  );
}

export function useAccount(): AccountValue {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccount must be used inside AccountProvider");
  return ctx;
}
