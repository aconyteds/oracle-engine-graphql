import { ApolloServerErrorCode } from "@apollo/server/errors";
import { GraphQLError } from "graphql";

export const ServerError = (
  message: string | Record<string, unknown>,
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
  console.warn("Unauthorized access attempt");
  return new GraphQLError("You are not authorized to view this resource.", {
    extensions: {
      code: ApolloServerErrorCode.BAD_REQUEST,
    },
  });
};

export const InactiveAccountError = () => {
  return new GraphQLError("Your account is inactive.", {
    extensions: {
      code: "INACTIVE_USER",
    },
  });
};
