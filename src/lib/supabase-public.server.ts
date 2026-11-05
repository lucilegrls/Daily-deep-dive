import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

/**
 * Server-side reader client. It uses the publishable key, so row-level
 * security applies: only published topics and approved resources come back.
 */
export function createPublicServerClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Backend is not configured.");

  return createClient<Database>(url, key, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.delete("Authorization");
        headers.set("apikey", key);
        // A hung backend (e.g. mid-restart) must fail visibly, not spin forever.
        const timeout = AbortSignal.timeout(10_000);
        const signal = init?.signal
          ? AbortSignal.any([init.signal, timeout])
          : timeout;
        return fetch(input, { ...init, headers, signal });
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
