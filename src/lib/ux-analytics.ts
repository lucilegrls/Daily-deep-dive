import { supabase } from "@/integrations/supabase/client";

export type UxSurface = "onboarding" | "reading_community";
export type UxEvent =
  | "step_viewed"
  | "step_completed"
  | "step_back"
  | "journey_skipped"
  | "journey_completed"
  | "community_viewed"
  | "period_changed";

const STORAGE_PREFIX = "daily-deep-dive:ux-journey:";

function fallbackUuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    return (char === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
}

export function uxJourney(surface: UxSurface): string {
  if (typeof window === "undefined") return fallbackUuid();
  const key = `${STORAGE_PREFIX}${surface}`;
  try {
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const next = globalThis.crypto?.randomUUID?.() ?? fallbackUuid();
    window.sessionStorage.setItem(key, next);
    return next;
  } catch {
    return globalThis.crypto?.randomUUID?.() ?? fallbackUuid();
  }
}

export function finishUxJourney(surface: UxSurface): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(`${STORAGE_PREFIX}${surface}`);
  } catch {
    // Measurement must never block the reading experience.
  }
}

export function recordUxEvent(input: {
  journeyId: string;
  surface: UxSurface;
  event: UxEvent;
  variant?: "signup" | "edit" | "week" | "all";
  step?: number;
  elapsedMs?: number;
}): void {
  const args = {
    _journey_id: input.journeyId,
    _surface: input.surface,
    _event_name: input.event,
    ...(input.variant === undefined ? {} : { _variant: input.variant }),
    ...(input.step === undefined ? {} : { _step: input.step }),
    ...(input.elapsedMs === undefined
      ? {}
      : { _elapsed_ms: Math.max(0, Math.round(input.elapsedMs)) }),
  };
  const record = supabase.rpc as unknown as (
    name: "record_ux_event",
    values: typeof args,
  ) => PromiseLike<{ error: { message: string } | null }>;
  void record("record_ux_event", args).then(({ error }) => {
    if (error && import.meta.env.DEV) {
      console.warn("UX measurement unavailable", error.message);
    }
  });
}
