import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_saved_topics",
  title: "List my saved topics",
  description: "List the topics the signed-in reader has saved.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const { data: saved, error } = await supabase.from("saved_topics").select("topic_id").eq("user_id", ctx.getUserId()!).limit(200);
    if (error) throw new ToolError("Could not load saved topics.");
    const ids = (saved ?? []).map((s) => s.topic_id);
    if (!ids.length) return { content: [{ type: "text", text: "No saved topics." }], structuredContent: { topics: [] } };
    const { data } = await supabase.from("content_topics").select("slug, title, category").in("id", ids).eq("status", "published");
    const topics = (data ?? []).map((t) => ({ slug: t.slug, title: t.title, category: t.category }));
    return { content: [{ type: "text", text: topics.map((t) => `${t.slug} — ${t.title}`).join("\n") }], structuredContent: { topics } };
  },
});
