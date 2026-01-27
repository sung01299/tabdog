/**
 * Firebase Configuration
 * 
 * 1. Copy this file to firebase-config.js
 * 2. Replace the values with your Firebase project settings
 * 
 * Get these from Firebase Console > Project Settings > General > Your apps
 */

export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
};

/**
 * Chrome Extension OAuth2 Client ID
 * 
 * Create this in Google Cloud Console:
 * 1. Go to APIs & Services > Credentials
 * 2. Create OAuth 2.0 Client ID (Web application type)
 * 3. Add authorized redirect URI: https://YOUR_EXTENSION_ID.chromiumapp.org/
 */
export const CHROME_CLIENT_ID = "YOUR_OAUTH_CLIENT_ID.apps.googleusercontent.com";

/**
 * Firebase REST API endpoints (no changes needed)
 */
export const FIREBASE_AUTH_URL = "https://identitytoolkit.googleapis.com/v1";
export const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;
