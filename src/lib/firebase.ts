import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported as analyticsIsSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const getEnvValue = (key: keyof ImportMetaEnv) => {
  const value = import.meta.env[key];
  if (!value || value.startsWith("your_") || value === "") {
    throw new Error(
      `Missing or invalid Firebase env var ${key}. Copy .env.example to .env and fill in your Firebase web config values.`
    );
  }
  return value;
};

const firebaseConfig = {
  apiKey: getEnvValue("VITE_FIREBASE_API_KEY"),
  authDomain: getEnvValue("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: getEnvValue("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: getEnvValue("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: getEnvValue("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: getEnvValue("VITE_FIREBASE_APP_ID"),
  measurementId: getEnvValue("VITE_FIREBASE_MEASUREMENT_ID"),
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

if (typeof window !== "undefined") {
  analyticsIsSupported().then(supported => {
    if (supported) {
      getAnalytics(app);
    }
  });
}
