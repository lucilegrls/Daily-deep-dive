import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { runDailyExpansion } from "@/lib/editorial.server";

/**
 * Daily expansion run: drafts new topics from the idea backlog into the review
 * queue. It never publishes. Callable by the scheduler with the workspace cron
 * secret, so it can run once a day.
 */
export const Route = createFileRoute("/api/public/editorial/daily-expansion")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Always authenticated: the preview URL is public too.
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const url = new URL(request.url);
        const target = Math.min(
          Math.max(Number(url.searchParams.get("target") ?? 10) || 10, 1),
          20,
        );
        const result = await runDailyExpansion(target);
        return Response.json(result);
      },
    },
  },
});
