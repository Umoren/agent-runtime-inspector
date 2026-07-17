import { describe, expect, it } from "vitest";
import { traceEventSchema } from "./events.js";

describe("trace event schema", () => {
  it("strips legacy tool descriptions and input schemas from tool inventory evidence", () => {
    const parsed = traceEventSchema.parse({
      id: "evt_legacy_inventory",
      runId: "run_legacy_inventory",
      timestamp: "2026-07-17T00:00:00.000Z",
      type: "tool.listed",
      path: "action",
      source: "merge",
      payload: {
        toolPackId: "tp_legacy",
        registeredUserId: "ru_legacy",
        tools: [
          {
            name: "github__get_authenticated_user",
            description: "Return the authenticated GitHub user.",
            inputSchema: {
              type: "object",
              properties: {}
            }
          }
        ]
      }
    });

    expect(parsed.type).toBe("tool.listed");
    if (parsed.type === "tool.listed") {
      expect(parsed.payload.tools).toEqual([{ name: "github__get_authenticated_user" }]);
      expect(parsed.payload.toolCount).toBeUndefined();
      expect(parsed.payload.inventoryHash).toBeUndefined();
    }
  });
});
