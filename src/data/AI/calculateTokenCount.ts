import { encoding_for_model } from "tiktoken";

export const calculateTokenCount = (message: string): number => {
  const encoder = encoding_for_model("gpt-4o");

  // Tokenize the message
  const tokens = encoder.encode(message);

  encoder.free();

  // Calculate the number of tokens in the message
  return tokens.length;
};
