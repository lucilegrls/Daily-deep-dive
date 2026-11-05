import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const SUGGESTION_TITLE_MIN = 8;
export const SUGGESTION_TITLE_MAX = 160;
export const SUGGESTION_DETAILS_MAX = 1200;

/** Reader-facing columns. `editor_note` is never selected here. */
const READER_COLUMNS = "id, title, details, lane_slug, status, created_at";

export interface ReaderSuggestion {
  id: string;
  title: string;
  details: string | null;
  lane_slug: string | null;
  status: string;
  created_at: string;
}

export const SUGGESTION_STATUS_LABELS: Record<string, string> = {
  new: "In the queue",
  reviewed: "Read by an editor",
  planned: "Planned for a future dive",
  declined: "Not taken further",
  published: "Handled",
};

export function suggestionStatusLabel(status: string): string {
  return SUGGESTION_STATUS_LABELS[status] ?? "In the queue";
}

function validateSuggestion(data: unknown) {
  const input = (data ?? {}) as Record<string, unknown>;
  const title = String(input["title"] ?? "").trim();
  if (
    title.length < SUGGESTION_TITLE_MIN ||
    title.length > SUGGESTION_TITLE_MAX
  ) {
    throw new Error(
      `Please write between ${SUGGESTION_TITLE_MIN} and ${SUGGESTION_TITLE_MAX} characters.`,
    );
  }
  const rawDetails = String(input["details"] ?? "").trim();
  if (rawDetails.length > SUGGESTION_DETAILS_MAX) {
    throw new Error("Please keep the details under 1,200 characters.");
  }
  const rawLane = String(input["lane_slug"] ?? "").trim();
  return {
    title,
    details: rawDetails.length > 0 ? rawDetails : null,
    lane_slug: rawLane.length > 0 ? rawLane : null,
  };
}

export const submitSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateSuggestion)
  .handler(async ({ context, data }): Promise<ReaderSuggestion> => {
    const { data: row, error } = await context.supabase
      .from("topic_suggestions")
      .insert({
        user_id: context.userId,
        title: data.title,
        details: data.details,
        lane_slug: data.lane_slug,
      })
      .select(READER_COLUMNS)
      .single();
    if (error) {
      if (error.message.includes("suggestion_rate_limit"))
        throw new Error("You have sent many suggestions today — please try again tomorrow.");
      if (error.message.includes("suggestion_duplicate"))
        throw new Error("You have already suggested this topic; it is in the queue.");
      console.error(JSON.stringify({ event: "suggestion_insert_failed", code: error.code }));
      throw new Error("Your suggestion could not be sent just now. Please try again.");
    }
    return row as ReaderSuggestion;
  });

export const listMySuggestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ReaderSuggestion[]> => {
    const { data, error } = await context.supabase
      .from("topic_suggestions")
      .select(READER_COLUMNS)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []) as ReaderSuggestion[];
  });
