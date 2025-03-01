export type TrustedModel = {
  modelName: string;
  modelProvider: AvailableProvider;
  contextWindow: number;
};

export type TrustedModelName = "gpt-4o-mini" | "gpt-4o" | "gpt-4" | "latest";
export type AvailableProvider = "OpenAI";

export const TRUSTED_MODELS = new Map<TrustedModelName, TrustedModel>([
  [
    "gpt-4o-mini",
    {
      modelName: "gpt-4o-mini",
      modelProvider: "OpenAI",
      contextWindow: 128_000,
    },
  ],
  [
    "gpt-4o",
    {
      modelName: "gpt-4o",
      modelProvider: "OpenAI",
      contextWindow: 128_000,
    },
  ],
  [
    "gpt-4",
    {
      modelName: "gpt-4",
      modelProvider: "OpenAI",
      contextWindow: 8_192,
    },
  ],
  [
    "latest",
    {
      modelName: "chatgpt-4o-latest",
      modelProvider: "OpenAI",
      contextWindow: 128_000,
    },
  ],
]);

export function getModelByName(name: TrustedModelName): TrustedModel {
  return TRUSTED_MODELS.get(name) as TrustedModel;
}
