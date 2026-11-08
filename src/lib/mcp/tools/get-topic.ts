import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_topic",
  title: "Get topic",
  description: "Read one published topic's summary, key takeaways and approved bibliography by slug.",
  inputSchema: { slug: z.string().min(1).max(200).describe("Topic slug from search_topics.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ slug }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const { data: topic, error } = await supabase
      .from("content_topics").select("id, slug, title, category, context, takeaways")
      .eq("status", "published").eq("slug", slug).maybeSingle();
    if (error) throw new ToolError("Could not load the topic.");
    if (!topic) throw new ToolError("No published topic with that slug.");
    const { data: res } = await supabase
      .from("content_resources").select("kind, title, url")
      .eq("topic_id", topic.id).eq("review_status", "approved").limit(30);
    const sources = (res ?? []).map((r) => ({ kind: String(r.kind), title: r.title, url: r.url }));
    const takeaways = Array.isArray(topic.takeaways) ? topic.takeaways.map(String) : [];
    const text = [`${topic.title} (${topic.category})`, topic.context ?? "", ...takeaways.map((t) => `• ${t}`), "Sources:", ...sources.map((s) => `- [${s.kind}] ${s.title} ${s.url}`)].join("\n");
    return {
      content: [{ type: "text", text }],
      structuredContent: { topic: { slug: topic.slug, title: topic.title, category: topic.category, context: topic.context ?? "", takeaways, sources } },
    };
  },
});
