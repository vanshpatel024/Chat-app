import { doc, getDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "./Firebase"; // your initialized firestore instance

export const getUserProfile = async (uid) => {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
};

export const createUserProfile = async (uid, email, username) => {
    const ref = doc(db, "users", uid);
    await setDoc(ref, {
        uid,
        username,
        email,
        SiginMethod: "google"
    });
};

export const isUsernameTaken = async (username) => {
    const ref = collection(db, "users");
    const q = query(ref, where("username", "==", username));
    const snapshot = await getDocs(q);
    return !snapshot.empty;
};

export const getUserByEmail = async (email) => {
    const ref = collection(db, "users");
    const q = query(ref, where("email", "==", email));
    const snapshot = await getDocs(q);
    return snapshot.empty ? null : snapshot.docs[0].data();
};
