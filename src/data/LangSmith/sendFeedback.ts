import { LangSmithClient } from "./client";

/**
 * Parameters for sending feedback to LangSmith.
 */
export type SendLangSmithFeedbackParams = {
  /** The LangSmith run ID (UUID) associated with the message */
  runId: string;
  /** User's sentiment: true = positive (thumbs up), false = negative (thumbs down) */
  humanSentiment: boolean;
  /** Optional comments from the user */
  comments?: string;
};

/**
 * Sends user feedback to LangSmith for trace analysis.
 *
 * This function uses a fire-and-forget pattern to ensure it never blocks
 * the feedback capture process. The API call is not awaited, and any
 * errors are silently caught and logged.
 *
 * **Non-blocking pattern:**
 * - Returns `void` immediately
 * - API call happens asynchronously
 * - Errors are caught and logged, never thrown
 * - Never impacts user feedback submission
 *
 * **Feedback key convention:**
 * - Uses "user_sentiment" as the feedback key
 * - Score: 1 for positive (thumbs up), 0 for negative (thumbs down)
 * - Includes optional comment from user
 *
 * @param params - Feedback parameters including runId, sentiment, and optional comments
 *
 * @example
 * ```typescript
 * // Fire-and-forget - no await needed
 * sendLangSmithFeedback({
 *   runId: message.runId,
 *   humanSentiment: true,
 *   comments: "Very helpful response!",
 * });
 * // Execution continues immediately
 * ```
 */
export function sendLangSmithFeedback({
  runId,
  humanSentiment,
  comments,
}: SendLangSmithFeedbackParams): void {
  // Fire and forget - don't await the API call
  LangSmithClient.createFeedback(runId, "user_sentiment", {
    score: humanSentiment ? 1 : 0,
    comment: comments,
    feedbackSourceType: "app",
  }).catch((error) => {
    // Silent failure - feedback should never break the application
    // Common case: run doesn't exist in LangSmith due to sampling
    console.warn("LangSmith feedback submission failed:", error);
  });
}
