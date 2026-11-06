import { auth } from "./Firebase";
import { getUserByEmail, isUsernameTaken, createUserProfile } from "./FirestoreUtils.jsx";
import { updateProfile } from "firebase/auth";

/**
 * Detect whether the user is opening the app within an in-app webview
 * (Instagram, Facebook, TikTok, Line, etc.) which blocks Google OAuth.
 */
export function isInAppBrowser() {
    if (typeof window === "undefined" || !window.navigator) return false;
    const ua = navigator.userAgent || navigator.vendor || window.opera || "";
    return /FBAN|FBAV|Instagram|TikTok|musical_ly|ByteDance|Line\/|Twitter|Snapchat|MicroMessenger/i.test(ua);
}

/**
 * Shared post-login processor for Google authenticated users across popup and redirect flows.
 * Handles profile lookup, conflict checking with email/password accounts, auto-profile creation,
 * local storage token caching, and routing to /home.
 */
export async function processGoogleUserAuth(user, { navigate, showNotification }) {
    if (!user) return false;

    const existingUser = await getUserByEmail(user.email);

    // Block login if this email was originally registered using manual email/password
    const signMethod = existingUser?.SiginMethod || existingUser?.loginMethod;
    if (existingUser && signMethod && signMethod !== "google") {
        showNotification("This account was registered using Email/Password. Please login using email.");
        await auth.signOut();
        return false;
    }

    if (!existingUser) {
        // Auto-generate clean, unique username without whitespace
        const baseUsername = user.displayName?.trim().replace(/\s+/g, "_") || user.email.split("@")[0];
        let chosenUsername = baseUsername;
        const taken = await isUsernameTaken(chosenUsername);
        if (taken) {
            chosenUsername = `${baseUsername}_${Math.floor(1000 + Math.random() * 9000)}`;
        }

        await createUserProfile(user.uid, user.email, chosenUsername);
        if (auth.currentUser) {
            await updateProfile(auth.currentUser, { displayName: chosenUsername });
        }
    }

    localStorage.setItem("userEmail", user.email);
    localStorage.setItem("userPassword", "GOOGLE");

    showNotification("Google login successful!");
    navigate("/home", { replace: true });
    return true;
}

