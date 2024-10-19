export type TrustedModel = {
  model: string;
  alias: string;
  contextWindow: number;
};

export type TrustedModelName = "gpt-4o-mini" | "gpt-4o" | "gpt-4" | "latest";

export const TRUSTED_MODELS = new Map<TrustedModelName, TrustedModel>([
  [
    "gpt-4o-mini",
    {
      model: "gpt-4o-mini",
      alias: "gpt-4o-mini",
      contextWindow: 128_000,
    },
  ],
  [
    "gpt-4o",
    {
      model: "gpt-4o",
      alias: "gpt-4o",
      contextWindow: 128_000,
    },
  ],
  [
    "gpt-4",
    {
      model: "gpt-4",
      alias: "gpt-4",
      contextWindow: 8_192,
    },
  ],
  [
    "latest",
    {
      model: "chatgpt-4o-latest",
      alias: "latest",
      contextWindow: 128_000,
    },
  ],
]);
