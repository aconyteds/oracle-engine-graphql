import { credential } from "firebase-admin";
import { cert, initializeApp } from "firebase-admin/app";
import { ENV } from "../../config/environment";

export const initializeFirebase = () => {
  if (ENV.FIREBASE_CONFIG_BASE64) {
    // For production
    const firebaseConfig = JSON.parse(
      Buffer.from(ENV.FIREBASE_CONFIG_BASE64, "base64").toString("ascii")
    ) as Record<string, unknown>;
    initializeApp({
      credential: cert(firebaseConfig),
    });
  } else if (ENV.GOOGLE_APPLICATION_CREDENTIALS) {
    // For local development
    initializeApp({
      credential: credential.applicationDefault(),
    });
  } else {
    if (ENV.NODE_ENV === "production") {
      throw new Error("Firebase configuration not found");
    }
    // For local development without Firebase Auth
    console.warn("Firebase configuration not found, disabling Firebase Auth");
  }
};
