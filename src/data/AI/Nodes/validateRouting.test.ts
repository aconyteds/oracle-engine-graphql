import { test, expect, beforeEach, describe } from "bun:test";
import type { RouterGraphState } from "../Workflows/routerWorkflow";

import { validateRouting } from "./validateRouting";

describe("validateRouting", () => {
  const defaultState = {
    currentResponse: "Valid response content",
    routingMetadata: {
      decision: null,
      executionTime: 100,
      success: true,
      fallbackUsed: false,
    },
  } as unknown as typeof RouterGraphState.State;

  beforeEach(() => {
    // No mocks to clear for this validation function
  });

  test("Unit -> validateRouting marks as successful with valid response", async () => {
    const result = await validateRouting(defaultState);

    expect(result.routingMetadata?.success).toBe(true);
    expect(result.currentResponse).toBe("Valid response content");
  });

  test("Unit -> validateRouting marks as unsuccessful with empty response", async () => {
    const state = {
      ...defaultState,
      currentResponse: "",
    };

    const result = await validateRouting(state);

    expect(result.routingMetadata?.success).toBe(false);
  });

  test("Unit -> validateRouting marks as unsuccessful with null response", async () => {
    const state = {
      ...defaultState,
      currentResponse: null,
    };

    const result = await validateRouting(state);

    expect(result.routingMetadata?.success).toBe(false);
  });

  test("Unit -> validateRouting marks as unsuccessful with undefined response", async () => {
    const state = {
      ...defaultState,
      currentResponse: undefined,
    };

    const result = await validateRouting(state);

    expect(result.routingMetadata?.success).toBe(false);
  });

  test("Unit -> validateRouting respects existing success false metadata", async () => {
    const state = {
      ...defaultState,
      currentResponse: "Valid response",
      routingMetadata: {
        ...defaultState.routingMetadata!,
        success: false,
      },
    };

    const result = await validateRouting(state);

    expect(result.routingMetadata?.success).toBe(false);
  });

  test("Unit -> validateRouting preserves other routing metadata", async () => {
    const customMetadata = {
      decision: { targetAgent: "test-agent" },
      executionTime: 250,
      success: true,
      fallbackUsed: true,
      customField: "value",
    };
    const state = {
      ...defaultState,
      routingMetadata: customMetadata,
    };

    const result = await validateRouting(state);

    expect(result.routingMetadata?.decision).toEqual({
      targetAgent: "test-agent",
    });
    expect(result.routingMetadata?.executionTime).toBe(250);
    expect(result.routingMetadata?.fallbackUsed).toBe(true);
    expect(result.routingMetadata?.customField).toBe("value");
  });

  test("Unit -> validateRouting preserves all other state properties", async () => {
    const fullState = {
      ...defaultState,
      messages: ["message1", "message2"],
      runId: "test-run-123",
      isRouted: true,
      targetAgent: { name: "test-agent" },
    };

    const result = await validateRouting(fullState);

    expect(result).toEqual(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      expect.objectContaining({
        messages: ["message1", "message2"],
        runId: "test-run-123",
        isRouted: true,
        targetAgent: { name: "test-agent" },
      })
    );
  });

  test("Unit -> validateRouting handles whitespace-only response", async () => {
    const state = {
      ...defaultState,
      currentResponse: "   \n\t  ",
    };

    const result = await validateRouting(state);

    expect(result.routingMetadata?.success).toBe(true);
  });

  test("Unit -> validateRouting handles long valid response", async () => {
    const longResponse = "A".repeat(1000);
    const state = {
      ...defaultState,
      currentResponse: longResponse,
    };

    const result = await validateRouting(state);

    expect(result.routingMetadata?.success).toBe(true);
    expect(result.currentResponse).toBe(longResponse);
  });
});
