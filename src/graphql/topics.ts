import type { PubSubEngine } from "graphql-subscriptions";
import { PubSub } from "graphql-subscriptions";

import type { Message } from "../generated/graphql";

export type MessageCreatedPayload = {
  threadId: string;
  message: Message;
};

// Define a type map for the topics
type PubSubTypeMap = {
  messageCreated: MessageCreatedPayload;
};

class TypedPubSub<T extends Record<string, unknown>> implements PubSubEngine {
  private pubsub: PubSub;

  constructor() {
    this.pubsub = new PubSub();
  }

  async publish<K extends keyof T>(
    triggerName: K,
    payload: T[K]
  ): Promise<void> {
    return this.pubsub.publish(triggerName as string, payload);
  }

  subscribe<K extends keyof T>(
    triggerName: K,
    onMessage: (payload: T[K]) => void
  ): Promise<number> {
    return this.pubsub.subscribe(triggerName as string, onMessage);
  }

  unsubscribe(subId: number): void {
    this.pubsub.unsubscribe(subId);
  }

  asyncIterator<TPayload>(
    triggers: string | string[]
  ): AsyncIterator<TPayload> {
    const triggerNames = Array.isArray(triggers) ? triggers : [triggers];
    return this.pubsub.asyncIterator<TPayload>(triggerNames);
  }
}

const pubsub = new TypedPubSub<PubSubTypeMap>();

export default pubsub;
