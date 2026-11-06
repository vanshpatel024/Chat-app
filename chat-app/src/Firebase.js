import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

if (!firebaseConfig.apiKey) {
    console.error(
        "[Firebase] Missing VITE_FIREBASE_API_KEY. Please ensure environment variables are configured in .env locally or in your deployment dashboard (e.g. Vercel)."
    );
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Use local persistence by default so auth sessions persist across refreshes and tabs
if (typeof window !== 'undefined') {
    setPersistence(auth, browserLocalPersistence).catch(() => {});
    // Pre-warm the popup resolver so the auth iframe is cached upfront
    // to prevent browser popup-blocking caused by delayed iframe initialization
    if (auth._popupRedirectResolver && typeof auth._popupRedirectResolver._initialize === 'function') {
        auth._popupRedirectResolver._initialize(auth).catch(() => {});
    }
}

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
const db = getFirestore(app);

export { auth, googleProvider, db };
