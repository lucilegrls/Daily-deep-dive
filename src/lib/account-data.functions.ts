import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logEvent } from "@/lib/diagnostics";

/** Everything a reader owns, read through their own session (RLS applies). */
export const exportMyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const uid = context.userId;
    const [profile, interests, saved, reads, notes, progress, suggestions] = await Promise.all([
      sb.from("profiles").select("display_name, theme, feed_mix, onboarded, created_at").eq("id", uid).maybeSingle(),
      sb.from("user_interests").select("subject, created_at").eq("user_id", uid),
      sb.from("saved_topics").select("topic_id, created_at").eq("user_id", uid),
      sb.from("topic_reads").select("topic_id, read_day, seconds").eq("user_id", uid),
      sb.from("topic_notes").select("topic_id, body, updated_at").eq("user_id", uid),
      sb.from("resource_progress").select("resource_id, completed_at, position, updated_at").eq("user_id", uid),
      sb.from("topic_suggestions").select("title, details, status, created_at").eq("user_id", uid),
    ]);
    const failed = [profile, interests, saved, reads, notes, progress, suggestions].some((r) => r.error);
    if (failed) {
      logEvent("account", "export_failed", {}, "error");
      throw new Error("We couldn't prepare your data right now. Please try again.");
    }
    logEvent("account", "export_ok");
    return {
      exported_at: new Date().toISOString(),
      profile: profile.data,
      interests: interests.data,
      saved_topics: saved.data,
      reads: reads.data,
      notes: notes.data,
      reading_progress: progress.data,
      suggestions: suggestions.data,
    };
  });

/**
 * Permanently deletes the signed-in reader's account. Their own records cascade
 * away; shared editorial content (topics, sources) is never touched. Owner and
 * editor accounts must be handed over first, so the library is never orphaned.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    if ((d as Record<string, unknown>)?.["confirm"] !== "DELETE") throw new Error("Type DELETE to confirm.");
    return { confirm: "DELETE" as const };
  })
  .handler(async ({ context }) => {
    const { data: editor } = await context.supabase.rpc("is_editor");
    if (editor === true) {
      throw new Error("Editor and owner accounts can't be deleted here. Hand over the role first.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Reports carry no foreign key to the account, so remove them explicitly.
    await supabaseAdmin.from("resource_embed_failures").delete().eq("reporter", context.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) {
      logEvent("account", "delete_failed", { status: error.status }, "error");
      throw new Error("We couldn't delete your account right now. Please try again.");
    }
    logEvent("account", "delete_ok");
    return { ok: true };
  });
