import { ChatOpenAI } from "@langchain/openai";

import type { AIAgentDefinition } from "./types";

type AvailableModelTypes = ChatOpenAI;

const DEFAULT_PROPERTIES = {
  temperature: 0.7,
};

export function getModelDefinition(
  agent: AIAgentDefinition
): AvailableModelTypes {
  const { model } = agent;
  switch (model.modelProvider) {
    case "OpenAI":
      return new ChatOpenAI({
        ...DEFAULT_PROPERTIES,
        ...(agent.clientConfigurationOverrides ?? {}),
        apiKey: process.env.OPENAI_API_KEY,
        model: model.modelName,
      });
    default:
      throw new Error("Invalid model provider");
  }
}
