import { reportClientError } from "@/lib/client-error.functions";

const DEDUPE_MS = 30_000;
let lastReportAt = 0;

export function sendClientError(
  kind: "error_boundary" | "window_error" | "unhandled_rejection",
  status?: number,
) {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (now - lastReportAt < DEDUPE_MS) return;
  lastReportAt = now;
  void reportClientError({
    data: {
      kind,
      route: window.location.pathname,
      ...(status !== undefined ? { status } : {}),
    },
  }).catch(() => {
    // Reporting must never create a second visible failure.
  });
}
