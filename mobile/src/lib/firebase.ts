// Firebase JS SDK, initialized against the SAME project as the website.
// Because it's the same project, accounts created on the site work in the app
// and vice-versa. Auth state is persisted to AsyncStorage so viewers stay
// signed in between launches.

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  initializeAuth,
  getAuth,
  // getReactNativePersistence isn't in the public type surface for all versions,
  // so we import it loosely below.
  type Auth,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FIREBASE_CONFIG } from "./config";

// getReactNativePersistence lives in firebase/auth but is sometimes missing from
// the bundled type declarations; pull it via a loose require to stay type-safe.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getReactNativePersistence } = require("firebase/auth") as {
  getReactNativePersistence: (storage: unknown) => unknown;
};

let app: FirebaseApp;
let auth: Auth;

export function getFirebaseApp(): FirebaseApp {
  if (!getApps().length) {
    app = initializeApp(FIREBASE_CONFIG);
  } else {
    app = getApp();
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  if (auth) return auth;
  const a = getFirebaseApp();
  try {
    auth = initializeAuth(a, {
      persistence: getReactNativePersistence(AsyncStorage) as never,
    });
  } catch {
    // Already initialized (fast refresh / re-entry): fall back to getAuth.
    auth = getAuth(a);
  }
  return auth;
}

export const firebaseConfigured = Boolean(FIREBASE_CONFIG.apiKey);
