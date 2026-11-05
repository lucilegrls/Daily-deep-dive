import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/** Scheduled verification batch. Cron secret required; no AI, no fetching. */
export const Route = createFileRoute("/api/public/editorial/verify-sources")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runVerificationBatch } = await import("@/lib/source-verification.server");
        return Response.json(await runVerificationBatch(supabaseAdmin, "schedule", 25));
      },
    },
  },
});
