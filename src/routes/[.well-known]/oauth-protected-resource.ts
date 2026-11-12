import { createFileRoute } from "@tanstack/react-router";

import { protectedResourceMetadata } from "@/lib/mcp/server";

export const Route = createFileRoute("/.well-known/oauth-protected-resource")({
  server: { handlers: { GET: ({ request }) => protectedResourceMetadata(request) } },
});
