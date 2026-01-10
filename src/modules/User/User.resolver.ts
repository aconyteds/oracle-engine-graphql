import { ApolloServerErrorCode } from "@apollo/server/errors";
import { GraphQLError } from "graphql";

import { checkRateLimit } from "../../data/RateLimiting/usageTracking";
import type { UserModule } from "./generated";
import { getCurrentUser, login } from "./service";

const UserResolvers: UserModule.Resolvers = {
  Query: {
    currentUser: async (_, __, { user }): Promise<UserModule.User | null> => {
      if (!user) {
        return null;
      }
      return getCurrentUser(user.id);
    },
  },
  Mutation: {
    login: async (
      _,
      { input },
      { user, token }
    ): Promise<UserModule.LoginPayload | null> => {
      if (!input) {
        throw new GraphQLError("Invalid request input", {
          extensions: {
            code: ApolloServerErrorCode.BAD_USER_INPUT,
          },
        });
      }
      if (user && token) {
        const currentUser = await getCurrentUser(user.id);
        if (!currentUser) {
          return null;
        }
        return {
          token,
          user: currentUser,
        };
      }
      return login(input);
    },
  },
  User: {
    dailyUsage: async (parent): Promise<UserModule.UserDailyUsage | null> => {
      const rateLimitCheck = await checkRateLimit(parent.id);
      return {
        current: rateLimitCheck.currentCount,
        limit: rateLimitCheck.maxCount === -1 ? null : rateLimitCheck.maxCount,
        percentUsed: rateLimitCheck.percentUsed,
      };
    },
  },
};

export default UserResolvers;
