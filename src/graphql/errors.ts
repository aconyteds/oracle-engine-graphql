import { GraphQLError } from "graphql";
import { ApolloServerErrorCode } from "@apollo/server/errors";

export const ServerError = (
  message: string | Object,
  code: ApolloServerErrorCode = ApolloServerErrorCode.INTERNAL_SERVER_ERROR
) => {
  const errorMessage =
    typeof message === "string" ? message : JSON.stringify(message, null, 2);
  return new GraphQLError(errorMessage, {
    extensions: {
      code: code,
    },
  });
};

export const InvalidUserCredentials = () => {
  return new GraphQLError("Invalid user credentials", {
    extensions: {
      code: ApolloServerErrorCode.BAD_USER_INPUT,
    },
  });
};

export const InvalidInput = (message: string) => {
  return new GraphQLError(message, {
    extensions: {
      code: ApolloServerErrorCode.BAD_USER_INPUT,
    },
  });
};

export const UnauthorizedError = () => {
  return new GraphQLError("You are not authorized to view this resource.", {
    extensions: {
      code: ApolloServerErrorCode.BAD_REQUEST,
    },
  });
};
