import { describe, expect, test } from "bun:test";
import { AGENT_LIST } from "./agentList";
import { RouterType } from "./types";

describe("Agent Configuration Validation", () => {
  test("Controller agents should not have Handoff sub-agents", () => {
    for (const agent of AGENT_LIST.values()) {
      if (
        agent.routerType === RouterType.Controller &&
        agent.availableSubAgents
      ) {
        for (const subAgent of agent.availableSubAgents) {
          expect(subAgent.routerType).not.toBe(RouterType.Handoff);
        }
      }
    }
  });
});
