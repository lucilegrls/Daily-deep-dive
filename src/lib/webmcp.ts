import { useEffect } from "react";

import type { TopicSummary } from "@/lib/content.functions";

type WebMcpResult = {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
};

type WebMcpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, boolean>;
  execute: (input: Record<string, unknown>) => WebMcpResult | Promise<WebMcpResult>;
};

declare global {
  interface Document {
    modelContext?: {
      registerTool(tool: WebMcpTool, options?: { signal?: AbortSignal }): Promise<void> | void;
    };
  }
}

export function useVisibleTopicTools(input: {
  items: TopicSummary[];
  isLoading: boolean;
  setSearch: (query: string) => void;
  openTopic: (id: number) => void;
}) {
  const { items, isLoading, setSearch, openTopic } = input;

  useEffect(() => {
    const modelContext = document.modelContext;
    if (!modelContext) return;
    const controller = new AbortController();
    const common = { signal: controller.signal };

    const register = (tool: WebMcpTool) => {
      void Promise.resolve(modelContext.registerTool(tool, common)).catch(() => {
        // Unsupported or policy-disabled browsers should behave normally.
      });
    };

    register({
      name: "list_visible_topics",
      description: "List the topics currently shown in the Curiosity, Sourced feed.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, idempotentHint: true },
      execute: async () => {
        if (isLoading) return { content: [{ type: "text", text: "Topics are still loading." }] };
        const topics = items
          .slice(0, 60)
          .map(({ id, slug, title, category }) => ({ id, slug, title, category }));
        return {
          content: [
            {
              type: "text",
              text: topics.length
                ? topics
                    .map((topic) => `${topic.id}: ${topic.title} (${topic.category})`)
                    .join("\n")
                : "No topics shown.",
            },
          ],
          structuredContent: { topics },
        };
      },
    });

    register({
      name: "search_feed",
      description:
        "Filter the visible feed by words in topic titles; use an empty query to clear it.",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string", maxLength: 120 } },
        required: ["query"],
        additionalProperties: false,
      },
      execute: async (args) => {
        const query = typeof args["query"] === "string" ? args["query"].slice(0, 120) : "";
        setSearch(query);
        return {
          content: [
            { type: "text", text: query ? `Searching for "${query}".` : "Search cleared." },
          ],
        };
      },
    });

    register({
      name: "open_topic",
      description: "Open one topic currently visible in the feed, using its numeric id.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "number" } },
        required: ["id"],
        additionalProperties: false,
      },
      execute: async (args) => {
        const id = Number(args["id"]);
        const topic = items.find((item) => item.id === id);
        if (!topic)
          return { content: [{ type: "text", text: "That topic is not in the current view." }] };
        openTopic(topic.id);
        return {
          content: [{ type: "text", text: `Opened "${topic.title}".` }],
          structuredContent: { topic: { id: topic.id, slug: topic.slug, title: topic.title } },
        };
      },
    });

    return () => controller.abort();
  }, [isLoading, items, openTopic, setSearch]);
}
