export interface FirebaseAuthResponse {
  /**
   * The Firebase ID token (JWT) for the authenticated user.
   * This token can be used to authenticate the user in your application.
   */
  idToken: string;

  /**
   * The email address associated with the authenticated user account.
   */
  email: string;

  /**
   * A long-lived token that can be used to obtain new ID tokens.
   * Store this securely on the client to maintain the user's session.
   */
  refreshToken: string;

  /**
   * The number of seconds in which the ID token expires.
   * Typically, this is "3600" for 1 hour.
   */
  expiresIn: string;

  /**
   * The unique identifier for the user in Firebase Authentication.
   * This is equivalent to the user's UID.
   */
  localId: string;

  /**
   * A boolean indicating whether the user account existed previously.
   * True for existing accounts, false for newly created accounts.
   */
  registered: boolean;
}
