import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from "react-router-dom";
import './StyleSheets/LoginPage.css';
import { useNotification } from './Notification';
import { auth, googleProvider, db } from "./Firebase";
import { createUserWithEmailAndPassword, updateProfile, signInWithPopup, browserSessionPersistence, setPersistence } from "firebase/auth";
import { collection, query, where, getDocs, setDoc, doc } from "firebase/firestore";
import { useLoading } from './LoadingContext';

import {
    getUserProfile,
    createUserProfile,
    isUsernameTaken,
    getUserByEmail
} from './FirestoreUtils.jsx';

function CNAPage() {
    //for star animation logic
    const containerRef = useRef(null);

    const navigate = useNavigate();

    const { showNotification } = useNotification();

    const [showUsernameModal, setShowUsernameModal] = useState(false);
    const [tempGoogleUser, setTempGoogleUser] = useState(null);
    const [newUsername, setNewUsername] = useState("");

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');

    const { showLoading, hideLoading } = useLoading();


    //---------------------------------------------------------------------------------------------------------

    
    const handleGoogleSignIn = async () => {
        try {
            showLoading();

            const persistence = browserSessionPersistence;
            await setPersistence(auth, persistence);

            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;

            const existingUser = await getUserByEmail(user.email);

            // Block login if already registered with email
            if (existingUser && existingUser.loginMethod !== "google") {
                showNotification("This account was registered using Email/Password. Please login using email.");

                await auth.currentUser.unlink("google.com");

                await auth.signOut();
                return;
            }

            if (!existingUser) {
                setTempGoogleUser(user);
                setShowUsernameModal(true);
                return;
            }

            localStorage.setItem("userEmail", user.email);
            localStorage.setItem("userPassword", "GOOGLE");

            showNotification("Google login successful!");
            navigate("/home");

        } catch (error) {
            console.error("Google login error:", error);
            showNotification("Google login failed. Try again.");
        } finally {
            hideLoading();
        }
    };

    const handleCreateAccount = async () => {
        if (!username) return showNotification("Please enter your username");
        if (!email) return showNotification("Please enter your email");
        if (!password) return showNotification("Please enter your password");

        try {
            showLoading();

            //checking if a user already exists with the same username
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("username", "==", username));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                showNotification("Username already taken. Try another one.");
                return;
            }

            //account creation logic
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            await updateProfile(user, { displayName: username });

            //save user info with username to Firestore
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                username: username,
                email: email,
                SiginMethod: "manual"
            });

            showNotification("Account created successfully!, Please logIn");

            setUsername('');
            setEmail('');
            setPassword('');

            navigate("/login");

        } catch (error) {
            console.error("Error creating account:", error.message);

            //email already in use
            if (error.code === "auth/email-already-in-use") {
                showNotification("Email already in use! please Login");

                setUsername('');
                setEmail('');
                setPassword('');

                navigate("/login");

                return;
            }

            showNotification("Account creation failed.");
        } finally {
            hideLoading();
        }
    };

    //star logic
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        //static stars
        for (let i = 0; i < 80; i++) {
            const star = document.createElement("div");
            star.className = "star";
            const size = Math.random() * 2 + 1 + "px";
            star.style.width = size;
            star.style.height = size;
            star.style.top = Math.random() * 100 + "%";
            star.style.left = Math.random() * 100 + "%";
            star.style.position = "absolute";

            // Unique animation duration and delay
            const duration = 2 + Math.random() * 3; // 2s - 5s
            const delay = Math.random() * 5; // 0s - 5s
            star.style.animation = `pulse ${duration}s ease-in-out ${delay}s infinite`;

            container.appendChild(star);
        }

        //shooting stars
        const interval = setInterval(() => {
            const numberOfStars = Math.floor(Math.random() * 3) + 2;

            for (let i = 0; i < numberOfStars; i++) {
                const delay = (Math.random() * 300) + 200;

                setTimeout(() => {
                    const shootingStar = document.createElement("div");
                    shootingStar.className = "shooting-star";
                    shootingStar.style.top = Math.random() * 50 + "%";
                    shootingStar.style.left = Math.random() * 100 + "%";
                    const angle = Math.random() * 30 - 15;
                    shootingStar.style.transform = `rotate(${angle}deg)`;

                    container.appendChild(shootingStar);

                    setTimeout(() => {
                        container.removeChild(shootingStar);
                    }, 3000);
                }, delay);
            }
        }, 3000);

        return () => {
            clearInterval(interval);
        };

    }, []);

    return (
        <div className="main-container" ref={containerRef}>

            {showUsernameModal && (
                <div className="username-modal-overlay">
                    <div className="login-card username-modal-card">
                        <h2>Choose a Username</h2>
                        <div className="input-container">
                            <input
                                type="text"
                                value={newUsername}
                                onChange={(e) => setNewUsername(e.target.value)}
                                placeholder="Enter unique username"
                            />
                        </div>
                        <div className="button-wrapper">
                            <button
                                className="login-button"
                                onClick={async () => {
                                    const trimmed = newUsername.trim();

                                    if (!trimmed) {
                                        showNotification("Username cannot be empty.");
                                        return;
                                    }
                                    const taken = await isUsernameTaken(trimmed);
                                    if (taken) {
                                        showNotification("Username is already taken.");
                                        return;
                                    }

                                    await createUserProfile(tempGoogleUser.uid, tempGoogleUser.email, trimmed);

                                    showNotification("Google login successful!");
                                    setShowUsernameModal(false);
                                    setNewUsername("");
                                    setTempGoogleUser(null);
                                    navigate("/home");
                                }}
                            >
                                Confirm
                            </button>
                            <button
                                className="login-button cancel-button"
                                onClick={async () => {
                                    if (auth.currentUser) {
                                        await auth.currentUser.delete();
                                        await auth.signOut();
                                    }
                                    setShowUsernameModal(false);
                                    setNewUsername("");
                                    setTempGoogleUser(null);
                                    showNotification("Google sign-in canceled.");
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="login-card">

                <h2>Create Account</h2>

                <div className="input-container">

                    <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
                    <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />

                </div>

                <div className="button-wrapper">

                    <button className='login-button' onClick={handleCreateAccount}>Create Account</button>

                    <div className="or-divider">
                        <span>or</span>
                    </div>

                    <button className="google-button" onClick={handleGoogleSignIn}>
                        <img className="google-icon" src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" />
                        Sign in with Google
                    </button>

                </div>

                <a href="/">Already have an account? Log In</a>

            </div>

        </div>
    );
}

export default CNAPage;
