import { describe, expect, it, vi } from "vitest";

import { friendlyError } from "./friendly-error";

describe("friendlyError", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  it("hides raw database errors", () => {
    expect(friendlyError(new Error('new row violates row-level security policy for table "topic_notes"'))).toBe("Something went wrong. Please try again.");
    expect(friendlyError(new Error("Could not find the table in the schema cache"))).not.toMatch(/schema/);
  });
  it("explains network, session and permission failures", () => {
    expect(friendlyError(new TypeError("Failed to fetch"))).toMatch(/connection/);
    expect(friendlyError(new Error("Unauthorized: Invalid token"))).toMatch(/sign in/);
    expect(friendlyError(Object.assign(new Error("x"), { status: 403 }))).toMatch(/access/);
    expect(friendlyError(new Error('duplicate key value violates unique constraint "x"'))).toMatch(/already/);
  });
  it("keeps our own short messages", () => {
    expect(friendlyError(new Error("Type DELETE to confirm."))).toBe("Type DELETE to confirm.");
  });
  it("handles non-errors", () => expect(friendlyError({})).toBe("Something went wrong. Please try again."));
});
