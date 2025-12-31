import type { AIAgentDefinition } from "../types";
import { characterAgent } from "./characterAgent";
import { cheapest } from "./cheapest";
import { defaultRouter } from "./defaultRouter";
import { locationAgent } from "./locationAgent";
import { plotAgent } from "./plotAgent";

// Initialize traditional agent list
const AGENT_LIST = new Map<string, AIAgentDefinition>(
  [cheapest, characterAgent, defaultRouter, locationAgent, plotAgent].map(
    (agent) => [agent.name, agent]
  )
);

export {
  AGENT_LIST,
  characterAgent,
  cheapest,
  defaultRouter,
  locationAgent,
  plotAgent,
};
