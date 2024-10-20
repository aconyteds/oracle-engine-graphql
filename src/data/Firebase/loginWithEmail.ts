import { GraphQLError } from "graphql";
import { ApolloServerErrorCode } from "@apollo/server/errors";

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
    const errorData = await response.json();
    console.error("Error logging in:", JSON.stringify(errorData, null, 2));
    throw new GraphQLError("Invalid email or password", {
      extensions: {
        code: ApolloServerErrorCode.BAD_USER_INPUT,
      },
    });
  }

  return response.json();
};
