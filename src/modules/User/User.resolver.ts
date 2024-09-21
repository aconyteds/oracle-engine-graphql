import { GraphQLError } from "graphql";
import { UserModule } from "./generated";
import { UserService } from "./User.service";
import { ApolloServerErrorCode } from "@apollo/server/errors";

const UserResolvers: UserModule.Resolvers = {
  Query: {
    currentUser: async (_, __, { userId, db }): Promise<UserModule.User> => {
      if (!userId) {
        throw new GraphQLError("Invalid authorization token", {
          extensions: {
            code: ApolloServerErrorCode.BAD_REQUEST,
          },
        });
      }

      const user = await db.user.findUnique({
        where: {
          id: userId,
        },
      });

      return {
        id: user.id,
        email: user.email,
        name: user.name,
      };
    },
  },
  Mutation: {
    login: async (
      _,
      { input },
      { user, token, db }
    ): Promise<UserModule.LoginPayload | null> => {
      const userService = new UserService(db);
      return userService.login(input, token, user);
    },
  },
};

export default UserResolvers;
