import { GraphQLError } from "graphql";
import { ApolloServerErrorCode } from "@apollo/server/errors";

import type { UserModule } from "./generated";
import { getUserThreads } from "../../data/MongoDB";
import { getCurrentUser, login } from "./service";
import type { ServerContext } from "../../serverContext";

const UserResolvers: UserModule.Resolvers = {
  Query: {
    currentUser: async (
      _,
      __,
      { user }: ServerContext
    ): Promise<UserModule.User | null> => {
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
      { user, token }: ServerContext
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
    threads: async (parent): Promise<UserModule.Thread[]> => {
      const threads = await getUserThreads(parent.id);
      return threads.map((thread) => ({
        id: thread.id,
        title: thread.title,
        createdAt: thread.createdAt.toISOString(),
        lastUsed: thread.updatedAt.toISOString(),
      }));
    },
  },
};

export default UserResolvers;
