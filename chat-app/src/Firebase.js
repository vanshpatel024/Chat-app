import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyDkBQyU0HUyKr21pp26cCOqRO27VdgbYSA",
    authDomain: "chat-app-6a105.firebaseapp.com",
    projectId: "chat-app-6a105",
    storageBucket: "chat-app-6a105.firebasestorage.app",
    messagingSenderId: "965325670062",
    appId: "1:965325670062:web:b0b8ea0caefc2d5a67cf3f",
    measurementId: "G-XB4H8KBYSG"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const db = getFirestore(app);

export { auth, googleProvider, db };