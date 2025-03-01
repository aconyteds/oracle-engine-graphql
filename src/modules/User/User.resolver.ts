import { GraphQLError } from "graphql";
import { ApolloServerErrorCode } from "@apollo/server/errors";

import type { UserModule } from "./generated";
import { UserService } from "./User.service";
import { getUserThreads } from "../../data/MongoDB";

const UserResolvers: UserModule.Resolvers = {
  Query: {
    currentUser: async (
      _,
      __,
      { user, db }
    ): Promise<UserModule.User | null> => {
      const userService = new UserService(db);
      return userService.getCurrentUser(user.id);
    },
  },
  Mutation: {
    login: async (
      _,
      { input },
      { user, token, db }
    ): Promise<UserModule.LoginPayload | null> => {
      if (!input) {
        throw new GraphQLError("Invalid request input", {
          extensions: {
            code: ApolloServerErrorCode.BAD_USER_INPUT,
          },
        });
      }
      const userService = new UserService(db);
      if (user) {
        const currentUser = await userService.getCurrentUser(user.id);
        if (!currentUser) {
          return null;
        }
        return {
          token,
          user: currentUser,
        };
      }
      return userService.login(input);
    },
  },
  User: {
    threads: async (parent, _, { db }): Promise<UserModule.Thread[]> => {
      const threads = await getUserThreads(db, parent.id);
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
