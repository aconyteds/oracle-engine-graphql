import type { DecodedIdToken } from "firebase-admin/auth";
import { getAuth } from "firebase-admin/auth";

import type { User } from "../MongoDB";
import { lookupUser } from "../MongoDB";

type VerifyUserResponse = {
  token?: DecodedIdToken;
  user?: User;
};

// User Cache so that we aren't hitting the Firebase/MongoDB servers for each update
// WebSockets will be hitting this function a lot, so we don't want to hit the DB every time
const userMap = new Map<string, VerifyUserResponse>();

export const verifyUser = async (
  idToken: string
): Promise<VerifyUserResponse | null> => {
  if (!idToken) {
    return null;
  }
  // Check if the user is already verified, and their token is still valid
  const cachedUser = userMap.get(idToken);
  if (cachedUser?.token?.exp && cachedUser.token.exp * 1000 > Date.now()) {
    return cachedUser;
  }
  // User is either not cached, or they have an expired token
  const decodedToken = await getAuth().verifyIdToken(idToken);
  const userCredential = await lookupUser(decodedToken.uid, decodedToken.email);
  if (!userCredential) {
    userMap.delete(idToken);
    return null;
  }
  const newCachedUser: VerifyUserResponse = {
    token: decodedToken,
    user: userCredential,
  };
  userMap.set(idToken, newCachedUser);
  return newCachedUser;
};
