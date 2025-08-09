import { credential } from "firebase-admin";
import { initializeApp, cert } from "firebase-admin/app";

export const initializeFirebase = () => {
  if (process.env.FIREBASE_CONFIG_BASE64) {
    // For production
    const firebaseConfig = JSON.parse(
      Buffer.from(process.env.FIREBASE_CONFIG_BASE64, "base64").toString(
        "ascii"
      )
    ) as Record<string, unknown>;
    initializeApp({
      credential: cert(firebaseConfig),
    });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // For local development
    initializeApp({
      credential: credential.applicationDefault(),
    });
  } else {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Firebase configuration not found");
    }
    // For local development without Firebase Auth
    console.warn("Firebase configuration not found, disabling Firebase Auth");
  }
};
