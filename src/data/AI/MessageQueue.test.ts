import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { GenerateMessagePayload } from "../../generated/graphql";
import { MessageQueue } from "./MessageQueue";

describe("MessageQueue", () => {
  let queue: MessageQueue;

  const mockPayload1: GenerateMessagePayload = {
    responseType: "Debug",
    content: "Test message 1",
  };

  const mockPayload2: GenerateMessagePayload = {
    responseType: "Debug",
    content: "Test message 2",
  };

  beforeEach(() => {
    queue = new MessageQueue();
  });

  afterEach(() => {
    // Clean up
  });

  test("Unit -> MessageQueue enqueue and dequeue messages", async () => {
    queue.enqueue(mockPayload1);
    queue.enqueue(mockPayload2);

    const message1 = await queue.dequeue();
    const message2 = await queue.dequeue();

    expect(message1).toEqual(mockPayload1);
    expect(message2).toEqual(mockPayload2);
  });

  test("Unit -> MessageQueue dequeue waits for message when queue is empty", async () => {
    // Start dequeue (it will wait)
    const dequeuePromise = queue.dequeue();

    // Enqueue a message after a delay
    setTimeout(() => {
      queue.enqueue(mockPayload1);
    }, 10);

    const message = await dequeuePromise;
    expect(message).toEqual(mockPayload1);
  });

  test("Unit -> MessageQueue complete resolves pending dequeue with null", async () => {
    const dequeuePromise = queue.dequeue();

    queue.complete();

    const message = await dequeuePromise;
    expect(message).toBeNull();
  });

  test("Unit -> MessageQueue isDone returns false when queue has messages", () => {
    queue.enqueue(mockPayload1);

    expect(queue.isDone()).toBe(false);
  });

  test("Unit -> MessageQueue isDone returns false when not complete", () => {
    expect(queue.isDone()).toBe(false);
  });

  test("Unit -> MessageQueue isDone returns true when complete and empty", async () => {
    queue.enqueue(mockPayload1);
    queue.complete();

    await queue.dequeue(); // Empty the queue

    expect(queue.isDone()).toBe(true);
  });

  test("Unit -> MessageQueue length returns correct count", () => {
    expect(queue.length).toBe(0);

    queue.enqueue(mockPayload1);
    expect(queue.length).toBe(1);

    queue.enqueue(mockPayload2);
    expect(queue.length).toBe(2);
  });

  test("Unit -> MessageQueue error marks queue as complete and errored", async () => {
    const dequeuePromise = queue.dequeue();

    queue.error();

    expect(queue.hasErrorOccurred()).toBe(true);
    expect(queue.isDone()).toBe(true);

    const message = await dequeuePromise;
    expect(message).toBeNull();
  });

  test("Unit -> MessageQueue dequeue returns null when complete and empty", async () => {
    queue.complete();

    const message = await queue.dequeue();
    expect(message).toBeNull();
  });

  test("Unit -> MessageQueue enqueue resolves waiting dequeue immediately", async () => {
    const dequeuePromise = queue.dequeue();

    // Immediately enqueue
    queue.enqueue(mockPayload1);

    // The dequeue should resolve immediately
    const message = await dequeuePromise;
    expect(message).toEqual(mockPayload1);

    // Queue should be empty
    expect(queue.length).toBe(0);
  });

  test("Unit -> MessageQueue handles multiple enqueues and dequeues", async () => {
    queue.enqueue(mockPayload1);
    const msg1 = await queue.dequeue();
    expect(msg1).toEqual(mockPayload1);

    queue.enqueue(mockPayload2);
    const msg2 = await queue.dequeue();
    expect(msg2).toEqual(mockPayload2);

    expect(queue.length).toBe(0);
  });

  test("Unit -> MessageQueue complete prevents new dequeues from blocking", async () => {
    queue.complete();

    const message1 = await queue.dequeue();
    const message2 = await queue.dequeue();

    expect(message1).toBeNull();
    expect(message2).toBeNull();
  });

  test("Unit -> MessageQueue accepts custom timeout value", () => {
    const customQueue = new MessageQueue(5000);
    expect(customQueue).toBeDefined();
  });

  test("Unit -> MessageQueue getErrorReason returns null by default", () => {
    expect(queue.getErrorReason()).toBeNull();
  });

  test("Unit -> MessageQueue error sets agent_error reason by default", () => {
    queue.error();
    expect(queue.getErrorReason()).toBe("agent_error");
    expect(queue.hasErrorOccurred()).toBe(true);
  });

  test("Unit -> MessageQueue error accepts custom timeout reason", () => {
    queue.error("timeout");
    expect(queue.getErrorReason()).toBe("timeout");
    expect(queue.hasErrorOccurred()).toBe(true);
  });

  test("Unit -> MessageQueue timeout triggers after inactivity period", async () => {
    const shortTimeoutQueue = new MessageQueue(100); // 100ms timeout

    // Start dequeue which will set up timeout timer
    const dequeuePromise = shortTimeoutQueue.dequeue();

    // Wait for timeout to trigger
    await new Promise((resolve) => setTimeout(resolve, 150));

    const result = await dequeuePromise;

    expect(result).toBeNull();
    expect(shortTimeoutQueue.hasErrorOccurred()).toBe(true);
    expect(shortTimeoutQueue.getErrorReason()).toBe("timeout");
  });

  test("Unit -> MessageQueue timeout resets when message enqueued", async () => {
    const shortTimeoutQueue = new MessageQueue(100); // 100ms timeout

    // Start dequeue which will set timeout
    const dequeuePromise = shortTimeoutQueue.dequeue();

    // Enqueue message before timeout expires
    setTimeout(() => shortTimeoutQueue.enqueue(mockPayload1), 50);

    const result = await dequeuePromise;

    expect(result).toEqual(mockPayload1);
    expect(shortTimeoutQueue.hasErrorOccurred()).toBe(false);
    expect(shortTimeoutQueue.getErrorReason()).toBeNull();
  });

  test("Unit -> MessageQueue timeout resets on each dequeue", async () => {
    const shortTimeoutQueue = new MessageQueue(100); // 100ms timeout

    // Enqueue first message
    shortTimeoutQueue.enqueue(mockPayload1);

    // Dequeue first message (should reset timeout)
    const result1 = await shortTimeoutQueue.dequeue();
    expect(result1).toEqual(mockPayload1);

    // Wait 50ms (less than timeout)
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Enqueue second message (should reset timeout)
    shortTimeoutQueue.enqueue(mockPayload2);

    // Dequeue second message
    const result2 = await shortTimeoutQueue.dequeue();
    expect(result2).toEqual(mockPayload2);

    // Should not have timed out
    expect(shortTimeoutQueue.hasErrorOccurred()).toBe(false);
  });

  test("Unit -> MessageQueue clears timeout on complete", async () => {
    const shortTimeoutQueue = new MessageQueue(50); // 50ms timeout

    // Start dequeue which will set timeout
    const dequeuePromise = shortTimeoutQueue.dequeue();

    // Complete before timeout
    setTimeout(() => shortTimeoutQueue.complete(), 10);

    const result = await dequeuePromise;

    // Wait to ensure timeout would have fired if not cleared
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(result).toBeNull();
    expect(shortTimeoutQueue.hasErrorOccurred()).toBe(false);
    expect(shortTimeoutQueue.getErrorReason()).toBeNull();
  });

  test("Unit -> MessageQueue clears timeout on error", async () => {
    const shortTimeoutQueue = new MessageQueue(50); // 50ms timeout

    // Start dequeue which will set timeout
    const dequeuePromise = shortTimeoutQueue.dequeue();

    // Call error before timeout
    setTimeout(() => shortTimeoutQueue.error("agent_error"), 10);

    const result = await dequeuePromise;

    // Wait to ensure timeout would have fired if not cleared
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(result).toBeNull();
    expect(shortTimeoutQueue.hasErrorOccurred()).toBe(true);
    expect(shortTimeoutQueue.getErrorReason()).toBe("agent_error");
  });

  test("Unit -> MessageQueue multiple sequential dequeues with activity", async () => {
    const shortTimeoutQueue = new MessageQueue(100);

    // First dequeue and enqueue
    const promise1 = shortTimeoutQueue.dequeue();
    setTimeout(() => shortTimeoutQueue.enqueue(mockPayload1), 20);
    const result1 = await promise1;
    expect(result1).toEqual(mockPayload1);

    // Second dequeue and enqueue
    const promise2 = shortTimeoutQueue.dequeue();
    setTimeout(() => shortTimeoutQueue.enqueue(mockPayload2), 20);
    const result2 = await promise2;
    expect(result2).toEqual(mockPayload2);

    // Should not have timed out
    expect(shortTimeoutQueue.hasErrorOccurred()).toBe(false);
  });

  test("Unit -> MessageQueue dequeue returns immediately if queue has messages", async () => {
    const shortTimeoutQueue = new MessageQueue(100);

    // Enqueue message first
    shortTimeoutQueue.enqueue(mockPayload1);

    // Dequeue should return immediately without setting timeout
    const result = await shortTimeoutQueue.dequeue();

    expect(result).toEqual(mockPayload1);
    expect(shortTimeoutQueue.hasErrorOccurred()).toBe(false);
  });
});
