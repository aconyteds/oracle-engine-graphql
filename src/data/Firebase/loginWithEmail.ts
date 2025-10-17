import { ApolloServerErrorCode } from "@apollo/server/errors";
import { GraphQLError } from "graphql";
import { logger } from "../../utils/logger";
import type { FirebaseAuthResponse } from "./models";

const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY;

export const loginWithEmailAndPassword = async (
  email: string,
  password: string
): Promise<FirebaseAuthResponse> => {
  const signInUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_WEB_API_KEY}`;

  const response = await fetch(signInUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      returnSecureToken: true,
    }),
  });

  if (!response.ok) {
    const errorData = (await response.json()) as {
      error?: { message?: string };
    };
    logger.error(
      "Error logging in:",
      new Error(errorData.error?.message || "Unknown Firebase error"),
      { errorData }
    );
    throw new GraphQLError("Invalid email or password", {
      extensions: {
        code: ApolloServerErrorCode.BAD_USER_INPUT,
      },
    });
  }

  return response.json() as Promise<FirebaseAuthResponse>;
};
