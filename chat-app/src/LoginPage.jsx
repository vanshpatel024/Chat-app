import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, Link } from "react-router-dom";
import './StyleSheets/LoginPage.css';
import { useNotification } from './Notification';
import { auth, googleProvider } from "./Firebase";
import { signInWithPopup, signInWithRedirect, getRedirectResult, signInWithEmailAndPassword, sendPasswordResetEmail, setPersistence, browserLocalPersistence, browserSessionPersistence, updateProfile } from "firebase/auth";
import { useLoading } from './LoadingContext';

import {
    createUserProfile,
    isUsernameTaken,
    getUserByEmail
} from './FirestoreUtils.jsx';

function LoginPage() {
    //for star animation logic
    const containerRef = useRef(null);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const [hasAutoLoggedIn, setHasAutoLoggedIn] = useState(false);
    const [isManualLogin, setIsManualLogin] = useState(false);

    const [showForgotPassword, setShowForgotPassword] = useState(false);

    const navigate = useNavigate();

    const { showNotification } = useNotification();

    //used for remember me logic
    const [rememberMe, setRememberMe] = useState(false);

    const { showLoading, hideLoading } = useLoading();

    const [showUsernameModal, setShowUsernameModal] = useState(false);
    const [tempGoogleUser, setTempGoogleUser] = useState(null);
    const [newUsername, setNewUsername] = useState("");
    
    
    //---------------------------------------------------------------------------------------------------------

    
    // Process authenticated Google user
    const isProcessingUser = useRef(false);

    const processGoogleUser = useCallback(async (user) => {
        if (!user || isProcessingUser.current) return;
        isProcessingUser.current = true;

        try {
            const existingUser = await getUserByEmail(user.email);

            // Block login if already registered with email
            const signMethod = existingUser?.SiginMethod || existingUser?.loginMethod;
            if (existingUser && signMethod && signMethod !== "google") {
                showNotification("This account was registered using Email/Password. Please login using email.");
                await auth.signOut();
                isProcessingUser.current = false;
                return;
            }

            if (!existingUser) {
                // Auto-generate unique username so the app starts immediately
                const baseUsername = user.displayName?.trim() || user.email.split('@')[0];
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
            navigate("/home");
        } catch (err) {
            console.error("Error processing Google user:", err);
            isProcessingUser.current = false;
        }
    }, [navigate, showNotification]);

    // Listen to Firebase Auth state directly (catches return from Google redirect or restored session)
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (user && !hasAutoLoggedIn) {
                showLoading();
                try {
                    await processGoogleUser(user);
                } catch (err) {
                    console.error("Auth state user error:", err);
                } finally {
                    hideLoading();
                }
            }
        });

        return () => unsubscribe();
    }, [hasAutoLoggedIn, processGoogleUser, showLoading, hideLoading]);

    // Handle Google redirect result on page load
    useEffect(() => {
        const handleRedirectResult = async () => {
            try {
                const result = await getRedirectResult(auth);
                if (result && result.user) {
                    showLoading();
                    setIsManualLogin(true);
                    await processGoogleUser(result.user);
                }
            } catch (error) {
                console.error("Redirect auth error:", error);
                if (error.code === 'auth/unauthorized-domain') {
                    showNotification("This domain is not authorized in Firebase Console. Please add it under Authorized Domains.");
                } else if (error.code !== 'auth/credential-already-in-use') {
                    showNotification("Google sign-in failed. Try again.");
                }
            } finally {
                hideLoading();
            }
        };

        handleRedirectResult();
    }, [processGoogleUser, showLoading, hideLoading, showNotification]);

    //auto login
    useEffect(() => {
        const tryAutoLogin = async () => {
            const storedEmail = localStorage.getItem("userEmail");
            const storedPassword = localStorage.getItem("userPassword");

            if (
                storedEmail &&
                storedPassword &&
                storedPassword !== "GOOGLE" &&
                !hasAutoLoggedIn &&
                !isManualLogin
            ) {
                try {
                    showLoading();
                    await setPersistence(auth, browserLocalPersistence);
                    await signInWithEmailAndPassword(auth, storedEmail, storedPassword);

                    setHasAutoLoggedIn(true);
                    showNotification("Auto Login Successful!");
                    navigate("/home");
                } catch (error) {
                    console.error("Auto login failed:", error);
                    localStorage.removeItem("userEmail");
                    localStorage.removeItem("userPassword");
                } finally {
                    hideLoading();
                }
            }
        };

        if (!hasAutoLoggedIn) {  // Run the effect only if auto-login has not happened yet
            tryAutoLogin();
        }
        
    }, [hasAutoLoggedIn, isManualLogin, navigate, showLoading, hideLoading, showNotification]);

    const handleGoogleLogIn = async (e) => {
        if (e && e.preventDefault) e.preventDefault();

        try {
            setIsManualLogin(true);

            let result = null;
            try {
                result = await signInWithPopup(auth, googleProvider);
            } catch (popupErr) {
                // If popup is blocked by browser, webview, or security policy, seamlessly fall back to redirect without popup blocked message
                if (popupErr.code === 'auth/popup-blocked' || popupErr.code === 'auth/cancelled-popup-request') {
                    showLoading();
                    await signInWithRedirect(auth, googleProvider);
                    return;
                }
                throw popupErr;
            }

            if (!result || !result.user) return;

            showLoading();

            const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
            await setPersistence(auth, persistence);

            await processGoogleUser(result.user);

        } catch (error) {
            console.error("Google login error:", error);
            if (error.code === 'auth/popup-blocked') {
                try {
                    showLoading();
                    await signInWithRedirect(auth, googleProvider);
                    return;
                } catch (redirectErr) {
                    console.error("Redirect error:", redirectErr);
                }
            } else if (error.code === 'auth/popup-closed-by-user') {
                // User closed popup; do not display error
            } else if (error.code === 'auth/unauthorized-domain') {
                showNotification("This domain is not authorized in Firebase Console. Please add it under Authorized Domains.");
            } else {
                showNotification("Google login failed. Try again.");
            }
        } finally {
            hideLoading();
        }
    };

    const handleLogin = async () => {
        if (!email) return showNotification("Please enter your email");
        if (!password) return showNotification("Please enter your password");

        try {
            showLoading();
            setIsManualLogin(true);

            const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
            await setPersistence(auth, persistence);
            await signInWithEmailAndPassword(auth, email, password);

            if (rememberMe) {
                localStorage.setItem("userEmail", email);
                localStorage.setItem("userPassword", password);
            } else {
                localStorage.removeItem("userEmail");
                localStorage.removeItem("userPassword");
            }

            showNotification("Login successful!");
            navigate("/home");

        } catch (error) {
            console.error("Login failed:", error);
            const message = error.code === 'auth/user-not-found'
                ? "User not found."
                : error.code === 'auth/invalid-credential'
                    ? "Email or Password is incorrect!"
                    : error.code === 'auth/wrong-password'
                        ? "Incorrect password."
                        : error.code === 'auth/invalid-email'
                            ? "Invalid email format."
                            : "Login failed. Try again.";

            showNotification(message);
            setPassword('');
        } finally {
            hideLoading();
        }
    };

    //handling reseting of password
    const handleResetPassword = async () => {
        if (!email) {
            showNotification("Please enter your registered email.");
            return;
        }

        try {
            showLoading();

            await sendPasswordResetEmail(auth, email);
            showNotification("Password reset link sent to your email.");

            setEmail('');
            setPassword('');
            setShowForgotPassword(false);
        } catch (error) {
            console.error("Reset error:", error);
            showNotification("Failed to send reset email.");
        } finally {
            hideLoading();
        }
    };

    //star logic
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        //removing exisiting stars for performance
        const existingStars = container.querySelectorAll('.star');
        existingStars.forEach(star => star.remove());

        // Static Stars
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

        // Shooting Stars
        const interval = setInterval(() => {
            const numberOfStars = Math.floor(Math.random() * 3) + 3;

            for (let i = 0; i < numberOfStars; i++) {
                const delay = (Math.random() * 500) + 400;

                setTimeout(() => {
                    const shootingStar = document.createElement("div");
                    shootingStar.className = "shooting-star";
                    shootingStar.style.top = Math.random() * 50 + "%";
                    shootingStar.style.left = Math.random() * 100 + "%";
                    const angle = Math.random() * 30 - 15;
                    shootingStar.style.transform = `rotate(${angle}deg)`;

                    container.appendChild(shootingStar);

                    setTimeout(() => {
                        shootingStar.remove();
                    }, 3000);
                }, delay);
            }
        }, 3000);

        return () => {
            clearInterval(interval);
            const allStars = container.querySelectorAll('.star, .shooting-star');
            allStars.forEach(star => star.remove());
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
                                    if (auth.currentUser) {
                                        await updateProfile(auth.currentUser, { displayName: trimmed });
                                    }

                                    localStorage.setItem("userEmail", tempGoogleUser.email);
                                    localStorage.setItem("userPassword", "GOOGLE");

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

                {/* forgot password page */}
                {showForgotPassword ? (
                    <>
                        <button className="back-btn" onClick={() => {
                            setEmail('');
                            setShowForgotPassword(false);
                        }}>
                            <i className="fas fa-arrow-left"></i>
                        </button>

                        <div className="forgot-top-bar">
                            <h2 className="forgot-header">Forgot Password</h2>
                        </div>

                        <div className="input-container">
                            <input
                                type="email"
                                placeholder="Registered Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        <div className="button-wrapper">
                            <button className="login-button" onClick={() => {
                                handleResetPassword();
                                setEmail('');
                            }}>Request</button>
                        </div>
                    </>
                ) : (
                    <>

                        <h2>Login</h2>

                        <div className="input-container">
                            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
                        </div>

                        <div className="checkbox-container">
                            <label className="remember-me">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                />
                                Remember me
                            </label>
                            <a onClick={() => setShowForgotPassword(true)} className="forgot-password">Forgot Password?</a>
                        </div>

                        <div className="button-wrapper">

                            <button className='login-button' onClick={handleLogin}>Login</button>

                            <div className="or-divider">
                                <span>or</span>
                            </div>

                            <button type="button" className="google-button" onClick={handleGoogleLogIn}>
                                <img className="google-icon" src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" />
                                Sign in with Google
                            </button>

                        </div>

                        <Link to="/create">Need an account? Sign Up</Link>

                    </>
                )}
            </div>
        </div>
    );
}

export default LoginPage;
