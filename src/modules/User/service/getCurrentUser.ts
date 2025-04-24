import { DBClient } from "../../../data/MongoDB";
import { GraphQLError } from "graphql";
import { ApolloServerErrorCode } from "@apollo/server/errors";
import type { UserModule } from "../generated";

export const getCurrentUser = async (
  /**
   * The ID of the user to retrieve, tied to the ID in the DB.
   */
  userId: string
): Promise<UserModule.User | null> => {
  if (!userId) {
    throw new GraphQLError("Invalid authorization token", {
      extensions: {
        code: ApolloServerErrorCode.BAD_REQUEST,
      },
    });
  }

  const user = await DBClient.user.findUnique({
    where: {
      id: userId,
    },
  });
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
  };
};
