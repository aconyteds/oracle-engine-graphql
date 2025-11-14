import { beforeEach, describe, expect, test } from "bun:test";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { cheapest } from "../Agents";
import type { RouterGraphState } from "../Workflows/routerWorkflow";

import { validateRouting } from "./validateRouting";

describe("validateRouting", () => {
  const mockAgent = cheapest;

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

  test("Unit -> validateRouting marks as unsuccessful with whitespace response as empty", async () => {
    const state = {
      ...defaultState,
      currentResponse: "",
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
      decision: defaultState.routingMetadata!.decision,
      executionTime: 250,
      success: true,
      fallbackUsed: true,
      userSatisfaction: 0.95,
    };
    const state = {
      ...defaultState,
      routingMetadata: customMetadata,
    };

    const result = await validateRouting(state);

    expect(result.routingMetadata?.decision).toEqual(
      defaultState.routingMetadata!.decision
    );
    expect(result.routingMetadata?.executionTime).toBe(250);
    expect(result.routingMetadata?.fallbackUsed).toBe(true);
    expect(result.routingMetadata?.userSatisfaction).toBe(0.95);
  });

  test("Unit -> validateRouting preserves all other state properties", async () => {
    const fullState = {
      ...defaultState,
      messages: [
        new SystemMessage("System message"),
        new HumanMessage("User message"),
      ],
      runId: "test-run-123",
      isRouted: true,
      targetAgent: mockAgent,
    };

    const result = await validateRouting(fullState);

    expect(result).toEqual(
      expect.objectContaining({
        runId: "test-run-123",
        isRouted: true,
        targetAgent: mockAgent,
      })
    );
    expect(result.messages).toHaveLength(2);
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
