import type { GenerateMessagePayload } from "../../generated/graphql";

const DEFAULT_TIMEOUT_MS = 30000;

type ErrorReason = "timeout" | "agent_error";

/**
 * Queue for managing async message streaming from agent execution
 * Enables real-time progress updates by allowing tools to enqueue messages
 * while the generator consumes and yields them
 */
export class MessageQueue {
  private queue: GenerateMessagePayload[] = [];
  private isComplete = false;
  private hasError = false;
  private errorReason: ErrorReason | null = null;
  private resolver: ((value: GenerateMessagePayload | null) => void) | null =
    null;
  private timeoutMs: number;
  private timeoutTimer: Timer | null = null;

  /**
   * @param timeoutMs - Debounce timeout in milliseconds (default: 30 seconds)
   *                    If no activity occurs within this period, the queue will error
   */
  constructor(timeoutMs: number = DEFAULT_TIMEOUT_MS) {
    this.timeoutMs = timeoutMs;
  }

  /**
   * Reset timeout timer on activity
   */
  private updateActivity(): void {
    this.clearTimeoutTimer();
  }

  /**
   * Clear the timeout timer if it exists
   */
  private clearTimeoutTimer(): void {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  }

  /**
   * Add a message to the queue
   * If a consumer is waiting, resolve immediately for real-time streaming
   */
  enqueue(payload: GenerateMessagePayload): void {
    this.updateActivity();
    this.queue.push(payload);
    if (this.resolver) {
      const resolve = this.resolver;
      this.resolver = null;
      resolve(this.queue.shift() || null);
    }
  }

  /**
   * Get next message from queue
   * Returns promise that resolves when message available or queue completes
   * Sets up a debounce timeout that triggers if no activity occurs within timeoutMs
   */
  async dequeue(): Promise<GenerateMessagePayload | null> {
    if (this.queue.length > 0) {
      this.updateActivity();
      return this.queue.shift() || null;
    }
    if (this.isComplete || this.hasError) {
      this.clearTimeoutTimer();
      return null;
    }

    // Set up timeout for inactivity
    this.timeoutTimer = setTimeout(() => {
      this.hasError = true;
      this.errorReason = "timeout";
      if (this.resolver) {
        const resolve = this.resolver;
        this.resolver = null;
        resolve(null);
      }
    }, this.timeoutMs);

    return new Promise((resolve) => {
      this.resolver = resolve;
    });
  }

  /**
   * Mark queue as complete (no more messages will be added)
   */
  complete(): void {
    this.isComplete = true;
    this.clearTimeoutTimer();
    if (this.resolver) {
      const resolve = this.resolver;
      this.resolver = null;
      resolve(null);
    }
  }

  /**
   * Mark queue as errored
   * @param reason - Optional reason for the error (defaults to "agent_error")
   */
  error(reason: ErrorReason = "agent_error"): void {
    this.hasError = true;
    this.errorReason = reason;
    this.isComplete = true;
    this.clearTimeoutTimer();
    if (this.resolver) {
      const resolve = this.resolver;
      this.resolver = null;
      resolve(null);
    }
  }

  /**
   * Check if queue is done (complete and empty)
   */
  isDone(): boolean {
    return this.isComplete && this.queue.length === 0;
  }

  /**
   * Get queue length
   */
  get length(): number {
    return this.queue.length;
  }

  /**
   * Check if queue encountered an error
   */
  hasErrorOccurred(): boolean {
    return this.hasError;
  }

  /**
   * Get the reason for the error, if any
   */
  getErrorReason(): ErrorReason | null {
    return this.errorReason;
  }
}
