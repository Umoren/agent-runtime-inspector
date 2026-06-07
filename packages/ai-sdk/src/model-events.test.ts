import { describe, expect, it } from "vitest";
import { createModelCalledEvent } from "./model-events.js";

describe("model event helpers", () => {
  it("creates a model called event", () => {
    const event = createModelCalledEvent({
      runId: "run_123",
      taskType: "summary",
      provider: "openai",
      model: "gpt-4.1-mini"
    });

    expect(event.type).toBe("model.called");
    expect(event.path).toBe("model");
    if (event.type === "model.called") {
      expect(event.payload.provider).toBe("openai");
    }
  });
});
