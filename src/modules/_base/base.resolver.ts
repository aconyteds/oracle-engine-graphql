import { DateTimeResolver } from "graphql-scalars";

import type { _BaseModule } from "./generated";

const start = Date.now();

const BaseResolvers: _BaseModule.Resolvers = {
  Query: {
    healthCheck: () => {
      return true;
    },
  },
  Subscription: {
    healthCheck: {
      resolve: () => {
        return true;
      },
      subscribe: async function* () {
        let interval: ReturnType<typeof setInterval> | undefined;

        try {
          interval = setInterval(() => {
            return true;
          }, 1000); // Adjust the interval as needed (1000ms = 1s)

          while (true) {
            yield true;
            await new Promise<void>((resolve) => setTimeout(resolve, 1000));
          }
        } finally {
          clearInterval(interval);
        }
      },
    },
    uptime: {
      resolve: () => {
        return Date.now() - start;
      },
      subscribe: async function* () {
        let interval: ReturnType<typeof setInterval> | undefined;

        try {
          interval = setInterval(() => {
            return Date.now() - start;
          }, 1000); // Adjust the interval as needed (1000ms = 1s)

          while (true) {
            yield Date.now() - start;
            await new Promise<void>((resolve) => setTimeout(resolve, 1000));
          }
        } finally {
          clearInterval(interval);
        }
      },
    },
  },
  DateTime: DateTimeResolver,
};

export default BaseResolvers;
