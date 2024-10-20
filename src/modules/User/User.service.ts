import { PrismaClient } from "@prisma/client";
import { GraphQLError } from "graphql";
import { ApolloServerErrorCode } from "@apollo/server/errors";

import type { UserModule } from "./generated";
import { loginWithEmailAndPassword } from "../../data/Firebase";
import { lookupUser } from "../../data/MongoDB";

export class UserService {
  private _db: PrismaClient = new PrismaClient();
  public constructor(public client: PrismaClient) {
    this._db = client;
  }
  public getCurrentUser = async (
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

    const user = await this._db.user.findUnique({
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

  public login = async (
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
      const userCredential = await lookupUser(
        this._db,
        loginToken.localId,
        email
      );

      return {
        token: loginToken.idToken,
        user: {
          id: userCredential.id,
          email: userCredential.email,
          name: userCredential.name,
        },
      };
    } catch (error) {
      console.error("Login error:", JSON.stringify(error, null, 2));
      throw new GraphQLError("Login error occurred", {
        extensions: {
          code: ApolloServerErrorCode.INTERNAL_SERVER_ERROR,
        },
      });
    }

    return null;
  };
}
