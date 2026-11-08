import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_topics",
  title: "Search topics",
  description: "Search published deep-dive topics by words in the title, optionally within one subject.",
  inputSchema: {
    query: z.string().max(120).optional().describe("Words to look for in topic titles."),
    category: z.string().max(80).optional().describe("Exact subject name to filter by."),
    limit: z.number().int().min(1).max(50).optional().describe("Maximum results (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, category, limit }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    let q = supabase.from("content_topics").select("id, slug, title, category").eq("status", "published").order("id").limit(limit ?? 20);
    if (query?.trim()) q = q.ilike("title", `%${query.trim().replace(/[%_,()]/g, " ")}%`);
    if (category) q = q.eq("category", category);
    const { data, error } = await q;
    if (error) throw new ToolError("Could not search topics.");
    const topics = (data ?? []).map((t) => ({ id: t.id, slug: t.slug, title: t.title, category: t.category }));
    return {
      content: [{ type: "text", text: topics.length ? topics.map((t) => `${t.slug} — ${t.title} (${t.category})`).join("\n") : "No topics found." }],
      structuredContent: { topics },
    };
  },
});
