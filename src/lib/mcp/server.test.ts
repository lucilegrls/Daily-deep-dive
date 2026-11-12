import { describe, expect, it } from "vitest";

import { handleMcpRequest } from "@/lib/mcp/server";

describe("MCP authentication boundary", () => {
  it("returns an OAuth protected-resource challenge without a bearer token", async () => {
    const response = await handleMcpRequest(
      new Request("https://example.test/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }),
      }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe(
      'Bearer resource_metadata="https://example.test/.well-known/oauth-protected-resource"',
    );
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
  });
});
