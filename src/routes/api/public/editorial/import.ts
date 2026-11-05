import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { importLibrary } from "@/lib/editorial.server";

/**
 * Idempotent import of the repository library into the content backend.
 * Callable by the scheduler with the workspace cron secret. In development it
 * can also be triggered locally to seed the preview database.
 */
export const Route = createFileRoute("/api/public/editorial/import")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Always authenticated: the preview URL is public too.
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const result = await importLibrary();
        return Response.json(result);
      },
    },
  },
});
