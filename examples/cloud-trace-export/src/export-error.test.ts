import { describe, expect, it } from "vitest";
import { cloudTraceFailureMessage } from "./export-error.js";

describe("Cloud Trace error messages", () => {
  it("reports a permission failure without printing provider error text", () => {
    const error = Object.assign(new Error("customer data must stay local"), { code: 7 });

    expect(cloudTraceFailureMessage(error)).toContain("PERMISSION_DENIED");
    expect(cloudTraceFailureMessage(error)).not.toContain("customer data must stay local");
  });

  it("uses a safe fallback when the provider gives no status code", () => {
    expect(cloudTraceFailureMessage(new Error("private provider detail"))).toBe(
      "Cloud Trace export failed. The provider returned an unrecognized status."
    );
  });
});
