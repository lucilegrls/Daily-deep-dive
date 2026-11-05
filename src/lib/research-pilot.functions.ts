import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertEditor(supabase: { rpc: (n: "is_editor") => PromiseLike<{ data: unknown }> }) {
  const { data } = await supabase.rpc("is_editor");
  if (data !== true) throw new Response("Forbidden", { status: 403 });
}

export const runResearchPilotStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertEditor(context.supabase as never);
    const { runPilotStep } = await import("@/lib/research-pilot.server");
    return runPilotStep(context.supabase, (u, i) => fetch(u, i));
  });

export const getResearchPilot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertEditor(context.supabase as never);
    const db = context.supabase;
    const [p, topics, calls, cands, ev] = await Promise.all([
      db.from("research_pilot").select("*").eq("id", 1).maybeSingle(),
      db.from("research_pilot_topics").select("topic_id, position, status, query, note").order("position"),
      db.from("research_pilot_calls").select("id, kind, topic_id, purpose, status, http_status, reserved_at").order("id"),
      db.from("research_candidates").select("id, topic_id, url, host, title, authority, existing_resource_id, selected_for_extract, blocked_checks").order("topic_id"),
      db.from("research_evidence").select("id, topic_id, url, outcome, excerpt, original_chars, stored_chars, truncated, content_hash, failure_reason, provider_request_id, retrieved_at, inspected_method").order("topic_id"),
    ]);
    return { pilot: p.data, topics: topics.data ?? [], calls: calls.data ?? [], candidates: cands.data ?? [], evidence: ev.data ?? [] };
  });
