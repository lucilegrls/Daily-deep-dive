import { createServerFn } from "@tanstack/react-start";

import { logEvent } from "@/lib/diagnostics";

type ClientErrorKind = "error_boundary" | "window_error" | "unhandled_rejection";

export const reportClientError = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => {
    const input = (value ?? {}) as Record<string, unknown>;
    const kind: ClientErrorKind =
      input["kind"] === "window_error" || input["kind"] === "unhandled_rejection"
        ? input["kind"]
        : "error_boundary";
    const rawRoute = typeof input["route"] === "string" ? input["route"] : "/";
    const route = rawRoute.startsWith("/") ? rawRoute.slice(0, 160) : "/";
    const status = Number(input["status"]);
    return {
      kind,
      route,
      ...(Number.isInteger(status) && status >= 400 && status <= 599 ? { status } : {}),
    };
  })
  .handler(async ({ data }) => {
    // Deliberately omit messages, stacks, URLs and user data. Cloudflare logs
    // retain only the failure class and page needed to spot a broken release.
    logEvent("api", "client_error", data, "error");
    return { ok: true };
  });
