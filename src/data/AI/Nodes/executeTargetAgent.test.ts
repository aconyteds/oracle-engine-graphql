import { test, expect, beforeEach, mock } from "bun:test";
import type { RouterGraphState } from "../Workflows/routerWorkflow";
import type { AIAgentDefinition } from "../types";

const mockGetModelDefinition = mock();
const mockRunToolEnabledWorkflow = mock();

const mockTargetAgent = {
  name: "target-agent",
  description: "Target agent for execution",
  availableTools: [{ name: "target-tool" }],
} as AIAgentDefinition;

const mockModel = {
  invoke: mock(),
};

mock.module("../getModelDefinition", () => ({
  getModelDefinition: mockGetModelDefinition,
}));

mock.module("../Workflows/toolEnabledWorkflow", () => ({
  runToolEnabledWorkflow: mockRunToolEnabledWorkflow,
}));

import { executeTargetAgent } from "./executeTargetAgent";

const defaultState = {
  messages: [{ content: "Test message" }],
  runId: "test-run-123",
  routingDecision: {
    targetAgent: mockTargetAgent,
    confidence: 85,
    reasoning: "Test routing",
  },
  routingMetadata: {
    decision: null,
    executionTime: 100,
    success: false,
    fallbackUsed: false,
  },
} as typeof RouterGraphState.State;

const defaultWorkflowResult = {
  currentResponse: "Target agent response",
  isComplete: true,
  metadata: { responseGenerated: true },
};

beforeEach(() => {
  mockGetModelDefinition.mockClear();
  mockRunToolEnabledWorkflow.mockClear();

  mockGetModelDefinition.mockReturnValue(mockModel);
  mockRunToolEnabledWorkflow.mockResolvedValue(defaultWorkflowResult);
});

test("Unit -> executeTargetAgent executes target agent successfully", async () => {
  const result = await executeTargetAgent(defaultState);

  expect(mockGetModelDefinition).toHaveBeenCalledWith(mockTargetAgent);
  expect(mockRunToolEnabledWorkflow).toHaveBeenCalledWith({
    messages: defaultState.messages,
    threadId: "test-run-123",
    agent: mockTargetAgent,
    tools: mockTargetAgent.availableTools,
  });
  expect(result.targetAgent).toBe(mockTargetAgent);
  expect(result.isRouted).toBe(true);
  expect(result.routingMetadata?.success).toBe(true);
});

test("Unit -> executeTargetAgent throws error when no routing decision", async () => {
  const stateWithoutDecision = {
    ...defaultState,
    routingDecision: null,
  };

  await expect(executeTargetAgent(stateWithoutDecision)).rejects.toThrow(
    "No routing decision available"
  );
});

test("Unit -> executeTargetAgent throws error when no target agent", async () => {
  const stateWithoutTarget = {
    ...defaultState,
    routingDecision: {
      targetAgent: null,
    },
  };

  await expect(executeTargetAgent(stateWithoutTarget)).rejects.toThrow();
});

test("Unit -> executeTargetAgent uses prepared messages when available", async () => {
  const preparedMessages = [{ content: "Prepared message" }];
  const stateWithPrepared = {
    ...defaultState,
    preparedMessages,
  };

  await executeTargetAgent(stateWithPrepared);

  expect(mockRunToolEnabledWorkflow).toHaveBeenCalledWith(
    expect.objectContaining({
      messages: preparedMessages,
    })
  );
});

test("Unit -> executeTargetAgent uses original messages when no prepared messages", async () => {
  const originalMessages = [{ content: "Original message" }];
  const stateWithOriginal = {
    ...defaultState,
    originalMessages,
    preparedMessages: undefined,
  };

  await executeTargetAgent(stateWithOriginal);

  expect(mockRunToolEnabledWorkflow).toHaveBeenCalledWith(
    expect.objectContaining({
      messages: originalMessages,
    })
  );
});

test("Unit -> executeTargetAgent falls back to messages when no prepared or original", async () => {
  await executeTargetAgent(defaultState);

  expect(mockRunToolEnabledWorkflow).toHaveBeenCalledWith(
    expect.objectContaining({
      messages: defaultState.messages,
    })
  );
});

test("Unit -> executeTargetAgent handles model configuration error", async () => {
  const originalConsoleError = console.error;
  const mockConsoleError = mock();
  console.error = mockConsoleError;

  mockGetModelDefinition.mockReturnValue(null);

  try {
    const result = await executeTargetAgent(defaultState);

    expect(mockConsoleError).toHaveBeenCalledWith(
      `Failed to execute target agent ${mockTargetAgent.name}:`,
      expect.any(Error)
    );
    expect(result.currentResponse).toBe(
      `I apologize, but I encountered an issue while processing your request with the ${mockTargetAgent.name} agent. Let me try a different approach.`
    );
    expect(result.routingMetadata?.success).toBe(false);
  } finally {
    console.error = originalConsoleError;
  }
});

test("Unit -> executeTargetAgent handles workflow execution error", async () => {
  const originalConsoleError = console.error;
  const mockConsoleError = mock();
  console.error = mockConsoleError;

  const testError = new Error("Workflow execution failed");
  mockRunToolEnabledWorkflow.mockRejectedValue(testError);

  try {
    const result = await executeTargetAgent(defaultState);

    expect(mockConsoleError).toHaveBeenCalledWith(
      `Failed to execute target agent ${mockTargetAgent.name}:`,
      testError
    );
    expect(result.routingMetadata?.success).toBe(false);
  } finally {
    console.error = originalConsoleError;
  }
});

test("Unit -> executeTargetAgent merges workflow result with state", async () => {
  const result = await executeTargetAgent(defaultState);

  expect(result.currentResponse).toBe("Target agent response");
  expect(result.isComplete).toBe(true);
  expect(result.metadata?.responseGenerated).toBe(true);
});

test("Unit -> executeTargetAgent preserves existing routing metadata", async () => {
  const stateWithMetadata = {
    ...defaultState,
    routingMetadata: {
      decision: { targetAgent: "previous-agent" },
      executionTime: 150,
      success: false,
      fallbackUsed: true,
      customField: "preserved",
    },
  };

  const result = await executeTargetAgent(stateWithMetadata);

  expect(result.routingMetadata?.decision).toEqual({
    targetAgent: "previous-agent",
  });
  expect(result.routingMetadata?.executionTime).toBe(150);
  expect(result.routingMetadata?.fallbackUsed).toBe(true);
  expect(result.routingMetadata?.customField).toBe("preserved");
  expect(result.routingMetadata?.success).toBe(true);
});

test("Unit -> executeTargetAgent preserves other state properties", async () => {
  const extendedState = {
    ...defaultState,
    customField: "value",
    routingAttempts: 2,
    maxRoutingAttempts: 5,
  };

  const result = await executeTargetAgent(extendedState);

  expect(result.customField).toBe("value");
  expect(result.routingAttempts).toBe(2);
  expect(result.maxRoutingAttempts).toBe(5);
});
