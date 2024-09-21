import { PrismaClient, User } from "@prisma/client";
import { UserModule } from "./generated";
import { GraphQLError } from "graphql";
import { ApolloServerErrorCode } from "@apollo/server/errors";
import { DecodedIdToken } from "firebase-admin/auth";
import { InputMaybe } from "../../generated/graphql";
import { loginWithEmailAndPassword } from "../../data/Firebase";
import { lookupUser } from "../../data/MongoDB";

export class UserService {
  private _db: PrismaClient = new PrismaClient();
  public constructor(public client: PrismaClient) {
    this._db = client;
  }

  public login = async (
    input?: InputMaybe<UserModule.LoginInput>,
    token?: string,
    user?: DecodedIdToken
  ): Promise<UserModule.LoginPayload | null> => {
    if (user) {
      const userCredential = await lookupUser(this._db, user.uid, user.email);
      return {
        token,
        user: {
          id: userCredential.id,
          email: userCredential.email,
          name: userCredential.name,
        },
      };
    }

    if (!input) {
      throw new GraphQLError("Invalid request input", {
        extensions: {
          code: ApolloServerErrorCode.BAD_REQUEST,
        },
      });
    }

    const { email, password } = input;
    if (!email || !password) {
      throw new GraphQLError("Invalid email or password", {
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
