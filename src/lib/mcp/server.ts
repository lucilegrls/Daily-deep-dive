import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

const MCP_PROTOCOL_VERSION = "2025-11-25";
const MCP_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Expose-Headers": "WWW-Authenticate",
};

type RpcId = string | number | null;
type RpcRequest = { jsonrpc?: unknown; id?: RpcId; method?: unknown; params?: unknown };
type Claims = { sub: string };

function environment(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function publicConfig() {
  const url = environment("SUPABASE_URL");
  const key = environment("SUPABASE_PUBLISHABLE_KEY");
  if (!url || !key) throw new Error("MCP server is missing Supabase configuration");
  return { url, key };
}

function apiFetch(apiKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((value, name) => headers.set(name, value));
    headers.set("apikey", apiKey);
    return fetch(input, { ...init, headers });
  };
}

function challenge(request: Request): Response {
  const metadata = new URL("/.well-known/oauth-protected-resource", request.url).href;
  return Response.json(
    { error: "unauthorized" },
    {
      status: 401,
      headers: {
        ...MCP_CORS_HEADERS,
        "WWW-Authenticate": `Bearer resource_metadata="${metadata}"`,
      },
    },
  );
}

async function userClient(request: Request) {
  const token = /^Bearer ([^\s,]+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return null;
  const { url, key } = publicConfig();
  const client = createClient<Database>(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` }, fetch: apiFetch(key) },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getClaims(token);
  const claims = data?.claims as unknown as Claims | undefined;
  if (error || !claims?.sub) return null;
  return { client, userId: claims.sub };
}

const tools = [
  {
    name: "search_topics",
    title: "Search topics",
    description: "Search published Curiosity, Sourced topics by title and optionally subject.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", maxLength: 120 },
        category: { type: "string", maxLength: 80 },
        limit: { type: "integer", minimum: 1, maximum: 50 },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "get_topic",
    title: "Get topic",
    description: "Read a published topic, its takeaways and approved bibliography by slug.",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string", minLength: 1, maxLength: 200 } },
      required: ["slug"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "list_saved_topics",
    title: "List my saved topics",
    description: "List the published topics saved by the signed-in reader.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
] as const;

function textResult(text: string, structuredContent?: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text }],
    ...(structuredContent ? { structuredContent } : {}),
  };
}

async function callTool(
  auth: NonNullable<Awaited<ReturnType<typeof userClient>>>,
  params: unknown,
) {
  const input = (params ?? {}) as Record<string, unknown>;
  const name = typeof input["name"] === "string" ? input["name"] : "";
  const args = (input["arguments"] ?? {}) as Record<string, unknown>;

  if (name === "search_topics") {
    const query = typeof args["query"] === "string" ? args["query"].trim().slice(0, 120) : "";
    const category = typeof args["category"] === "string" ? args["category"].slice(0, 80) : "";
    const limit = Math.min(Math.max(Math.trunc(Number(args["limit"])) || 20, 1), 50);
    let request = auth.client
      .from("content_topics")
      .select("id, slug, title, category")
      .eq("status", "published")
      .order("id")
      .limit(limit);
    if (query) request = request.ilike("title", `%${query.replace(/[%_,()]/g, " ")}%`);
    if (category) request = request.eq("category", category);
    const { data, error } = await request;
    if (error) throw new Error("Could not search topics");
    const topics = data ?? [];
    return textResult(
      topics.length
        ? topics.map((topic) => `${topic.slug} — ${topic.title} (${topic.category})`).join("\n")
        : "No topics found.",
      { topics },
    );
  }

  if (name === "get_topic") {
    const slug = typeof args["slug"] === "string" ? args["slug"].slice(0, 200) : "";
    if (!slug) throw new Error("A topic slug is required");
    const { data: topic, error } = await auth.client
      .from("content_topics")
      .select("id, slug, title, category, context, takeaways")
      .eq("status", "published")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw new Error("Could not load the topic");
    if (!topic) throw new Error("No published topic has that slug");
    const { data: resources, error: resourceError } = await auth.client
      .from("content_resources")
      .select("kind, title, url")
      .eq("topic_id", topic.id)
      .eq("review_status", "approved")
      .limit(30);
    if (resourceError) throw new Error("Could not load the bibliography");
    const sources = resources ?? [];
    const takeaways = Array.isArray(topic.takeaways) ? topic.takeaways.map(String) : [];
    const text = [
      `${topic.title} (${topic.category})`,
      topic.context,
      ...takeaways.map((item) => `• ${item}`),
      "Sources:",
      ...sources.map((source) => `- [${source.kind}] ${source.title} ${source.url}`),
    ].join("\n");
    return textResult(text, { topic: { ...topic, takeaways, sources } });
  }

  if (name === "list_saved_topics") {
    const { data: saved, error } = await auth.client
      .from("saved_topics")
      .select("topic_id")
      .eq("user_id", auth.userId)
      .limit(200);
    if (error) throw new Error("Could not load saved topics");
    const ids = (saved ?? []).map((row) => row.topic_id);
    if (!ids.length) return textResult("No saved topics.", { topics: [] });
    const { data, error: topicsError } = await auth.client
      .from("content_topics")
      .select("slug, title, category")
      .in("id", ids)
      .eq("status", "published");
    if (topicsError) throw new Error("Could not load saved topic details");
    const topics = data ?? [];
    return textResult(topics.map((topic) => `${topic.slug} — ${topic.title}`).join("\n"), {
      topics,
    });
  }

  throw new Error("Unknown tool");
}

function rpc(id: RpcId | undefined, result: unknown): Response {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, result }, { headers: MCP_CORS_HEADERS });
}

function rpcError(id: RpcId | undefined, code: number, message: string): Response {
  return Response.json(
    { jsonrpc: "2.0", id: id ?? null, error: { code, message } },
    { headers: MCP_CORS_HEADERS },
  );
}

export async function handleMcpRequest(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...MCP_CORS_HEADERS,
        "Access-Control-Allow-Headers": "authorization, content-type, mcp-protocol-version",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }
  if (request.method !== "POST")
    return Response.json(
      { error: "method_not_allowed" },
      { status: 405, headers: MCP_CORS_HEADERS },
    );
  const auth = await userClient(request);
  if (!auth) return challenge(request);

  const raw = await request.text();
  if (raw.length > 128_000)
    return Response.json(
      { error: "request_too_large" },
      { status: 413, headers: MCP_CORS_HEADERS },
    );
  let message: RpcRequest;
  try {
    message = JSON.parse(raw) as RpcRequest;
  } catch {
    return rpcError(null, -32700, "Parse error");
  }
  if (message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return rpcError(message.id, -32600, "Invalid request");
  }
  if (message.method === "initialize") {
    return rpc(message.id, {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "daily-deep-dive", title: "Curiosity, Sourced", version: "1.0.0" },
      instructions:
        "Search and read the curated library. All tools are read-only and run with the reader's Supabase permissions.",
    });
  }
  if (message.method === "notifications/initialized")
    return new Response(null, { status: 202, headers: MCP_CORS_HEADERS });
  if (message.method === "ping") return rpc(message.id, {});
  if (message.method === "tools/list") return rpc(message.id, { tools });
  if (message.method === "tools/call") {
    try {
      return rpc(message.id, await callTool(auth, message.params));
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Tool failed";
      return rpc(message.id, { ...textResult(messageText), isError: true });
    }
  }
  return rpcError(message.id, -32601, "Method not found");
}

export function protectedResourceMetadata(request: Request): Response {
  const { url } = publicConfig();
  return Response.json(
    {
      resource: new URL("/mcp", request.url).href,
      authorization_servers: [`${url}/auth/v1`],
      scopes_supported: ["openid", "email", "profile"],
      bearer_methods_supported: ["header"],
      resource_name: "Curiosity, Sourced",
    },
    { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300" } },
  );
}
