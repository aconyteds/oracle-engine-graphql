export type TrustedModel = {
  modelName: string;
  modelProvider: AvailableProvider;
  contextWindow: number;
};

export type TrustedModelName =
  | "gpt-4.1-mini"
  | "gpt-4.1"
  | "gpt-4.1-nano"
  | "text-embedding-3-small";
export type AvailableProvider = "OpenAI";

export const TRUSTED_MODELS = new Map<TrustedModelName, TrustedModel>([
  [
    "gpt-4.1-mini",
    {
      modelName: "gpt-4.1-mini",
      modelProvider: "OpenAI",
      contextWindow: 1_047_576,
    },
  ],
  [
    "gpt-4.1",
    {
      modelName: "gpt-4.1",
      modelProvider: "OpenAI",
      contextWindow: 1_047_576,
    },
  ],
  [
    "gpt-4.1-nano",
    {
      modelName: "gpt-4.1-nano",
      modelProvider: "OpenAI",
      contextWindow: 1_047_576,
    },
  ],
  [
    "text-embedding-3-small",
    {
      modelName: "text-embedding-3-small",
      modelProvider: "OpenAI",
      contextWindow: 8_191,
    },
  ],
]);

export function getModelByName(name: TrustedModelName): TrustedModel {
  return TRUSTED_MODELS.get(name) as TrustedModel;
}
