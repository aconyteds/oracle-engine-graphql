import { ApolloServerErrorCode } from "@apollo/server/errors";
import { GraphQLError } from "graphql";
import { loginWithEmailAndPassword } from "../../../data/Firebase";
import { lookupUser } from "../../../data/MongoDB";
import type { UserModule } from "../generated";
import { translateUserToGraphQLUser } from "../utils";

export const login = async (
  input: UserModule.LoginInput
): Promise<UserModule.LoginPayload | null> => {
  const { email, password } = input;
  if (!email || !password) {
    throw new GraphQLError("Invalid user credentials", {
      extensions: {
        code: ApolloServerErrorCode.BAD_USER_INPUT,
      },
    });
  }

  const loginToken = await loginWithEmailAndPassword(email, password);

  try {
    const userCredential = await lookupUser(loginToken.localId, email);

    return {
      token: loginToken.idToken,
      user: translateUserToGraphQLUser(userCredential),
    };
  } catch (error) {
    console.error("Login error:", error);
    throw new GraphQLError("Login error occurred", {
      extensions: {
        code: ApolloServerErrorCode.INTERNAL_SERVER_ERROR,
      },
    });
  }

  return null;
};
