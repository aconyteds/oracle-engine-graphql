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

class TypedPubSub<T extends Record<string, any>> implements PubSubEngine {
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

  asyncIterator<K extends keyof T>(triggers: K | K[]): AsyncIterator<T[K]> {
    return this.pubsub.asyncIterator(triggers as string | string[]);
  }
}

const pubsub = new TypedPubSub<PubSubTypeMap>();

export default pubsub;
