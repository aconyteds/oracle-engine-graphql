import { PrismaClient, User } from "@prisma/client";
import { DecodedIdToken, getAuth } from "firebase-admin/auth";
import { lookupUser } from "../MongoDB";

type VerifyUserResponse = {
  token?: DecodedIdToken;
  user?: User;
};

export const verifyUser = async (
  idToken: string,
  db: PrismaClient
): Promise<VerifyUserResponse | null> => {
  if (!idToken) {
    return null;
  }
  const decodedToken = await getAuth().verifyIdToken(idToken);
  const userCredential = await lookupUser(
    db,
    decodedToken.uid,
    decodedToken.email
  );
  return {
    token: decodedToken,
    user: userCredential,
  };
};
