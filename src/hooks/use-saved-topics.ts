import { classifyWriteError, type WriteFailure } from "@/lib/write-outcome";
import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/lib/account";

/**
 * Saved topics.
 *
 * Signed out, saves live on this device under a guest key. Signing in does NOT
 * absorb that guest list automatically: the reader has to ask for it, once,
 * for the account they meant. A successful import is consumed — the guest list
 * is cleared — so a second account can never inherit the first one's saves.
 */
const GUEST_KEY = "daily-deep-dive:saved:guest";
const LEGACY_KEY = "daily-deep-dive:saved";

type Status = "loading" | "ready" | "error";

function readGuest(): number[] {
  try {
    const raw =
      window.localStorage.getItem(GUEST_KEY) ??
      window.localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? [...new Set(parsed.filter((n): n is number => typeof n === "number"))]
      : [];
  } catch {
    return [];
  }
}

function writeGuest(ids: number[]) {
  try {
    window.localStorage.setItem(GUEST_KEY, JSON.stringify(ids));
  } catch {
    // Storage full, disabled or blocked: the in-memory list still works for
    // this session, it just will not survive a reload.
  }
}

function clearGuest() {
  try {
    window.localStorage.removeItem(GUEST_KEY);
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {
    // ignore
  }
}

export function useSavedTopics() {
  const { session } = useAccount();
  const userId = session?.user.id ?? null;

  const [saved, setSaved] = useState<number[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [pendingGuestCount, setPendingGuestCount] = useState(0);
  const [reloadToken, setReloadToken] = useState(0);
  // Bumped on every identity change so a slow reply for the previous identity
  // can never land in the new one's list.
  const generation = useRef(0);
  const inFlight = useRef(new Set<number>());
  const [writeError, setWriteError] = useState<WriteFailure | null>(null);
  const clearWriteError = useCallback(() => setWriteError(null), []);

  useEffect(() => {
    generation.current += 1;
    const mine = generation.current;

    // Whatever was on screen belonged to the previous identity. Drop it now.
    setSaved([]);
    setStatus("loading");

    if (!userId) {
      const guest = readGuest();
      setPendingGuestCount(0);
      setSaved(guest);
      setStatus("ready");
      return;
    }

    void (async () => {
      const { data, error } = await supabase
        .from("saved_topics")
        .select("topic_id")
        .eq("user_id", userId);
      if (generation.current !== mine) return;
      if (error) {
        setStatus("error");
        return;
      }
      setSaved((data ?? []).map((row) => row.topic_id));
      setPendingGuestCount(readGuest().length);
      setStatus("ready");
    })();
  }, [userId, reloadToken]);

  const retry = useCallback(() => setReloadToken((n) => n + 1), []);

  const toggle = useCallback(
    (id: number) => {
      const mine = generation.current;
      const owner = userId;

      setSaved((prev) => {
        const remove = prev.includes(id);
        const next = remove ? prev.filter((n) => n !== id) : [...prev, id];

        if (!owner) {
          writeGuest(next);
          return next;
        }

        if (inFlight.current.has(id)) return prev; // a write for this topic is still pending
        inFlight.current.add(id);
        void (async () => {
          let error: unknown = null;
          try {
          ({ error } = remove
            ? await supabase
                .from("saved_topics")
                .delete()
                .eq("user_id", owner)
                .eq("topic_id", id)
            : await supabase
                .from("saved_topics")
                .upsert(
                  { user_id: owner, topic_id: id },
                  { onConflict: "user_id,topic_id" },
                ));
          } catch (e) {
            error = e;
          } finally {
            inFlight.current.delete(id);
          }
          // Only roll the change back if it failed AND we are still the same
          // reader: otherwise the account already changed and this is stale.
          if (error && generation.current === mine) {
            setSaved((current) =>
              remove
                ? current.includes(id)
                  ? current
                  : [...current, id]
                : current.filter((n) => n !== id),
            );
            setWriteError(classifyWriteError(error));
          }
        })();

        return next;
      });
    },
    [userId],
  );

  /** Explicit, one-time import of this device's guest saves into this account. */
  const importGuestSaves = useCallback(async (): Promise<boolean> => {
    const owner = userId;
    if (!owner) return false;
    const mine = generation.current;
    const guest = readGuest();
    if (guest.length === 0) {
      setPendingGuestCount(0);
      return true;
    }

    const { error } = await supabase
      .from("saved_topics")
      .upsert(
        guest.map((topic_id) => ({ user_id: owner, topic_id })),
        { onConflict: "user_id,topic_id" },
      );
    if (error) {
      if (generation.current === mine) setStatus("error");
      return false;
    }

    // Written successfully — consume the guest list so no other account can
    // ever pick it up.
    clearGuest();
    if (generation.current === mine) {
      setSaved((prev) => [...new Set([...prev, ...guest])]);
      setPendingGuestCount(0);
      setStatus("ready");
    }
    return true;
  }, [userId]);

  const isSaved = useCallback((id: number) => saved.includes(id), [saved]);

  return {
    saved,
    toggle,
    isSaved,
    status,
    retry,
    writeError,
    clearWriteError,
    pendingGuestCount,
    importGuestSaves,
  };
}
