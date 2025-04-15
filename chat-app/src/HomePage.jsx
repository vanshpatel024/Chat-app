import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "./Firebase";
import { useNotification } from "./Notification";
import { useLoading } from './LoadingContext';
import "./StyleSheets/HomePage.css";
import ChatBox from "./ChatBox";
import Friends from "./Friends";
import { signOut, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import {
    query,
    where,
    doc,
    getDoc,
    getDocs,
    setDoc,
    serverTimestamp,
    collection,
    addDoc,
    deleteDoc,
    updateDoc,
    onSnapshot,
} from "firebase/firestore";

function HomePage() {
    const navigate = useNavigate();
    const { showNotification } = useNotification();
    const { showLoading, hideLoading } = useLoading();

    const [activeChatUser, setActiveChatUser] = useState(null); // user object
    const [chatId, setChatId] = useState(null);

    const [messageText, setMessageText] = useState("");

    const currentUid = auth.currentUser.uid;

    const typingTimeout = useRef(null);
    const lastTypingState = useRef(false);

    const [showAddFriendPopup, setShowAddFriendPopup] = useState(false);
    const [searchUsername, setSearchUsername] = useState("");
    const [searchResults, setSearchResults] = useState([]);

    const [friendRefreshToggle, setFriendRefreshToggle] = useState(false);
    const [friendIds, setFriendIds] = useState([]);

    const [showRequestsPopup, setShowRequestsPopup] = useState(false);
    const [incomingRequests, setIncomingRequests] = useState([]);

    const [showLogoutPopup, setShowLogoutPopup] = useState(false);

    const [showRemoveFriendPopup, setShowRemoveFriendPopup] = useState(false);

    const [showClearChatPopup, setShowClearChatPopup] = useState(false);

    const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);

    const [userStatus, setUserStatus] = useState(activeChatUser?.status || "offline");

    const [showChangeUsernamePopup, setShowChangeUsernamePopup] = useState(false);
    const [newUsername, setNewUsername] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");

    const [showChangePasswordPopup, setShowChangePasswordPopup] = useState(false);
    const [newPassword, setNewPassword] = useState("");
    const [currentPasswordForNewPassword, setCurrentPasswordForNewPassword] = useState("");
    const [confirmNewPassword, setConfirmNewPassword] = useState("");

    const [showProfilePopup, setShowProfilePopup] = useState(false);


    //---------------------------------------------------------------------------------------------------------


    //function to listen to the active chat user and update their status in real-time
    useEffect(() => {
        if (activeChatUser) {
            // Listen to real-time updates for the user's status
            const userRef = doc(db, "users", activeChatUser.id); // Change this to your user document path

            const unsubscribe = onSnapshot(userRef, (docSnapshot) => {
                if (docSnapshot.exists()) {
                    setUserStatus(docSnapshot.data().status); // Update the status in real-time
                }
            });

            // Clean up the listener on component unmount or when activeChatUser changes
            return () => unsubscribe();
        }
    }, [activeChatUser]);

    //fetching all the friend ids
    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;

        const userDocRef = doc(db, "users", user.uid);
        const friendsRef = collection(db, "users", user.uid, "friends");

        const setUserStatus = async (status) => {
            const snap = await getDoc(userDocRef);
            if (snap.exists()) {
                await updateDoc(userDocRef, { status });
            } else {
                await setDoc(userDocRef, { status }, { merge: true });
            }
        };

        // Set user online on page load
        setUserStatus("online");

        // Listen to changes in the "friends" subcollection
        const unsubscribeFriends = onSnapshot(friendsRef, (snapshot) => {
            const ids = snapshot.docs.map(doc => doc.id);
            setFriendIds(ids); // <- assumes you have this state setter declared in your component
        });

        // Handle browser/tab close
        const handleBeforeUnload = () => setUserStatus("offline");
        window.addEventListener("beforeunload", handleBeforeUnload);

        // Cleanup
        return () => {
            setUserStatus("offline");
            window.removeEventListener("beforeunload", handleBeforeUnload);
            unsubscribeFriends();
        };
    }, []);

    //fetching all the friend requests
    useEffect(() => {
        const fetchRequests = async () => {
            const requestsRef = collection(db, "users", currentUid, "friendRequests");
            const snapshot = await getDocs(requestsRef);
            const requests = await Promise.all(snapshot.docs.map(async (docSnap) => {
                const userDoc = await getDoc(doc(db, "users", docSnap.id));
                return { id: docSnap.id, ...userDoc.data() };
            }));
            setIncomingRequests(requests);
        };

        if (showRequestsPopup) fetchRequests();
    }, [showRequestsPopup]);

    //accepting friend request
    const handleAccept = async (senderId) => {
        await setDoc(doc(db, "users", currentUid, "friends", senderId), { addedAt: serverTimestamp() });
        await setDoc(doc(db, "users", senderId, "friends", currentUid), { addedAt: serverTimestamp() });

        await deleteDoc(doc(db, "users", currentUid, "friendRequests", senderId));

        setFriendIds(prev => [...prev, senderId]);
        setFriendRefreshToggle(prev => !prev);
        setIncomingRequests(prev => prev.filter(u => u.id !== senderId));
        showNotification("Friend request accepted!");
    };

    //rejecting friend request
    const handleReject = async (senderId) => {
        await deleteDoc(doc(db, "users", currentUid, "friendRequests", senderId));
        setIncomingRequests(prev => prev.filter(u => u.id !== senderId));
        showNotification("Friend request rejected.");
    };

    //listener for realtime adding and removing of friends
    useEffect(() => {
        if (!auth.currentUser) return;
        if (friendIds.length === 0) return;

        const unsubscribes = friendIds.map((friendId) => {
            const friendRef = collection(db, "users", friendId, "friends");
            return onSnapshot(friendRef, () => {
                setTimeout(() => {
                    setFriendRefreshToggle(prev => !prev);
                }, 1000); // 1 second delay
            });
        });

        return () => {
            unsubscribes.forEach(unsub => unsub());
        };
    }, [friendIds]);

    //as-you-type search for a friend
    useEffect(() => {
        const delayDebounce = setTimeout(async () => {
            if (searchUsername.trim() === "") {
                setSearchResults([]);
                return;
            }

            const usersRef = collection(db, "users");
            const snapshot = await getDocs(usersRef);
            const searchLower = searchUsername.toLowerCase();

            const matchedUsers = snapshot.docs
                .filter((doc) => {
                    const data = doc.data();
                    return (
                        data.username?.toLowerCase().includes(searchLower) &&
                        doc.id !== auth.currentUser.uid &&
                        !friendIds.includes(doc.id) // 👈 filter already added
                    );
                })
                .map((doc) => ({ id: doc.id, ...doc.data() }));

            setSearchResults(matchedUsers);
        }, 300);

        return () => clearTimeout(delayDebounce);
    }, [searchUsername, friendIds]);

    //function to handle adding a friend
    const handleAddFriend = async (friendId) => {
        const yourRequestRef = doc(db, "users", currentUid, "friendRequests", friendId);
        const theirRequestRef = doc(db, "users", friendId, "friendRequests", currentUid);

        const mutualCheck = await getDoc(theirRequestRef);

        const alreadySentSnap = await getDoc(theirRequestRef);
        if (alreadySentSnap.exists()) {
            showNotification("Friend request already sent.");
            return;
        }

        const mutualSnap = await getDoc(yourRequestRef);
        if (mutualSnap.exists()) {
            // Mutual request → auto accept
            await Promise.all([
                setDoc(doc(db, "users", currentUid, "friends", friendId), { addedAt: serverTimestamp() }),
                setDoc(doc(db, "users", friendId, "friends", currentUid), { addedAt: serverTimestamp() }),
                deleteDoc(yourRequestRef),
            ]);

            setFriendIds(prev => [...prev, friendId]);
            setFriendRefreshToggle(prev => !prev);
            showNotification("Friend added automatically (mutual request)!");
            return;
        }

        // 3. Not friends yet, no mutual → send request
        await setDoc(theirRequestRef, {
            from: currentUid,
            timestamp: serverTimestamp(),
        });

        showNotification("Friend request sent!");
        setSearchUsername("");
    };

    //clicking on a firend's button on the left panel
    const handleFriendClick = async (friendUser) => {
        setActiveChatUser(friendUser);
        const currentUid = auth.currentUser.uid;
        const friendUid = friendUser.id;

        // Generate consistent Chat ID
        const generatedChatId = [currentUid, friendUid].sort().join("_");
        setChatId(generatedChatId);

        // Optionally: Create chat document if it doesn't exist
        const chatRef = doc(db, "chats", generatedChatId);
        const chatDoc = await getDoc(chatRef);
        if (!chatDoc.exists()) {
            await setDoc(chatRef, {
                members: [currentUid, friendUid],
                createdAt: serverTimestamp(),
            });
        }
    };

    //function to update typing status in Firestore
    const updateTypingStatus = async (isTyping) => {
        if (!chatId) return;

        // Avoid sending duplicate states
        if (lastTypingState.current === isTyping) return;

        lastTypingState.current = isTyping;

        const typingRef = doc(db, "chats", chatId, "typingStatus", "status");
        await setDoc(
            typingRef,
            {
                [currentUid]: isTyping,
            },
            { merge: true }
        );
    };

    //function to handle input change and typing status
    const handleInputChange = (e) => {
        setMessageText(e.target.value);

        // User starts typing
        updateTypingStatus(true);

        // Clear previous timeout if user is still typing
        if (typingTimeout.current) {
            clearTimeout(typingTimeout.current);
        }

        // After 2s of inactivity, set isTyping to false
        typingTimeout.current = setTimeout(() => {
            updateTypingStatus(false);
        }, 2000);
    };

    //function to send message
    const handleSendMessage = async () => {
        if (!messageText.trim() || !chatId) return;

        const messageRef = collection(db, "chats", chatId, "messages");
        await addDoc(messageRef, {
            text: messageText,
            sender: auth.currentUser.uid,
            timestamp: serverTimestamp(),
        });

        setMessageText(""); // Clear input
    };

    //function to remove friend
    const handleRemoveFriend = async () => {
        if (!activeChatUser) return;

        const currentUid = auth.currentUser.uid;
        const friendUid = activeChatUser.id;

        try {
            //remove from both users friends subcollections
            await Promise.all([
                deleteDoc(doc(db, "users", currentUid, "friends", friendUid)),
                deleteDoc(doc(db, "users", friendUid, "friends", currentUid)),
            ]);

            //clear chat state if the removed friend was active
            setActiveChatUser(null);
            setChatId(null);

            setFriendIds((prev) => prev.filter((id) => id !== friendUid));
            setFriendRefreshToggle((prev) => !prev);

            setShowRemoveFriendPopup(false);
            showNotification("Friend removed successfully.");
        } catch (error) {
            console.error("Error removing friend:", error);
            showNotification("Failed to remove friend. Try again.");
        }
    };

    const handleClearChat = async () => {
        if (!chatId) return;

        try {
            const messagesRef = collection(db, "chats", chatId, "messages");
            const snapshot = await getDocs(messagesRef);

            const deletePromises = snapshot.docs.map((docSnap) =>
                deleteDoc(doc(db, "chats", chatId, "messages", docSnap.id))
            );

            await Promise.all(deletePromises);
            showNotification("Chat cleared successfully!");
        } catch (err) {
            console.error("Error clearing chat:", err);
            showNotification("Failed to clear chat. Try again.");
        }
    };

    //function to change username
    const handleChangeUsername = async () => {
        if (!newUsername.trim()) return showNotification("Please enter a new username.");
        if (!currentPassword.trim()) return showNotification("Please enter your current password.");

        const user = auth.currentUser;
        const trimmedUsername = newUsername.trim();

        if (!user || !user.email) {
            return showNotification("No user is currently logged in.");
        }

        try {
            showLoading();

            //check if username is already taken
            const usersRef = collection(db, "users");
            const usernameQuery = query(usersRef, where("username", "==", trimmedUsername));
            const snapshot = await getDocs(usernameQuery);

            const usernameTaken = snapshot.docs.some(doc => doc.id !== user.uid);

            if (usernameTaken) {
                hideLoading();
                return showNotification("Username is already taken. Please choose another one.");
            }

            //reauthenticate user
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);

            //update username in Firestore
            const userDocRef = doc(db, "users", user.uid);
            await updateDoc(userDocRef, {
                username: newUsername.trim(),
            });

            //success
            showNotification("Username changed successfully!");
            setShowChangeUsernamePopup(false);
            setNewUsername("");
            setCurrentPassword("");

        } catch (error) {
            console.error("Error changing username:", error);
            const message = error.code === "auth/invalid-credential"
                ? "Incorrect current password."
                : "Failed to change username. Try again.";

            showNotification(message);
        } finally {
            hideLoading();
        }
    };

    //function to change password
    const handleChangePassword = async () => {
        if (!currentPasswordForNewPassword.trim()) return showNotification("Please enter your current password.");
        if (!newPassword.trim()) return showNotification("Please enter a new password.");
        if (!confirmNewPassword.trim()) return showNotification("Please confirm your new password.");
        if (newPassword !== confirmNewPassword) return showNotification("Passwords do not match.");

        try {
            showLoading();

            const user = auth.currentUser;
            const credential = EmailAuthProvider.credential(user.email, currentPasswordForNewPassword);

            await reauthenticateWithCredential(user, credential);

            //if reauthentication is successful, update the password
            await updatePassword(user, newPassword);

            showNotification("Password changed successfully!");

            setCurrentPasswordForNewPassword('');
            setNewPassword('');
            setConfirmNewPassword('');
            showChangePasswordPopup(false);

        } catch (error) {
            console.error("Error changing password:", error.message);

            if (error.code === "auth/invalid-credential") {
                showNotification("Current password is incorrect.");
            }
        } finally {
            hideLoading();
        }
    };

    //function to handle logout
    const handleLogout = async () => {
        try {
            await signOut(auth);
            showNotification("Logged out successfully!");
            navigate("/login");
            localStorage.removeItem("userEmail");
            localStorage.removeItem("userPassword");
        } catch (error) {
            console.error("Logout error:", error);
            showNotification("Logout failed. Try again.");
        }
    };

    // Cancel pending debounce calls on cleanup
    useEffect(() => {
        return () => {
            if (typingTimeout.current) {
                clearTimeout(typingTimeout.current);
            }
        };
    }, [chatId]);



    return (
        <>
            <div className="main-container">

                {/* add friend popup */}
                {showAddFriendPopup && (
                    <div className="add-friend-overlay">
                        <div className="add-friend-card">
                            <div className="popup-header">
                                <h2>Add Friend</h2>
                                <button className="close-btn" onClick={() => setShowAddFriendPopup(false)}>
                                    <i className="fas fa-times"></i>
                                </button>
                            </div>
                            <input
                                type="text"
                                value={searchUsername}
                                onChange={(e) => setSearchUsername(e.target.value)}
                                placeholder="Search by username..."
                                className="friend-input"
                            />
                            <div className="search-results">
                                {searchUsername.trim() !== "" && searchResults.length === 0 ? (
                                    <p className="no-results">No users found</p>
                                ) : (
                                    searchResults.map((user) => (
                                        <div key={user.id} className="search-result-card">
                                            <span>{user.username}</span>
                                            <button className="add-friend-btn" onClick={() => handleAddFriend(user.id)}>
                                                <i className="fas fa-user-plus"></i>
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* friend requests popup */}
                {showRequestsPopup && (
                    <div className="add-friend-overlay">
                        <div className="add-friend-card">
                            <div className="popup-header">
                                <h2>Friend Requests</h2>
                                <button className="close-btn" onClick={() => setShowRequestsPopup(false)}>
                                    <i className="fas fa-times"></i>
                                </button>
                            </div>
                            <div className="search-results">
                                {incomingRequests.length === 0 ? (
                                    <p className="no-results">No pending requests</p>
                                ) : (
                                    incomingRequests.map((user) => (
                                        <div key={user.id} className="search-result-card">
                                            <span>{user.username}</span>
                                            <div>
                                                <button className="accept-btn" onClick={() => handleAccept(user.id)}>
                                                    <i className="fas fa-check"></i>
                                                </button>
                                                <button className="reject-btn" onClick={() => handleReject(user.id)}>
                                                    <i className="fas fa-times"></i>
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* logout popup */}
                {showLogoutPopup && (
                    <div className="add-friend-overlay">
                        <div className="add-friend-card">
                            <div className="popup-header">
                                <h2>Logout</h2>
                                <button className="close-btn" onClick={() => setShowLogoutPopup(false)}>
                                    <i className="fas fa-times"></i>
                                </button>
                            </div>

                            <p className="logout-prompt-text">Are you sure you want to logout?</p>

                            <div className="logout-button-wrapper">
                                <button className="reject-btn" onClick={handleLogout}>Yes</button>
                                <button className="accept-btn" onClick={() => setShowLogoutPopup(false)}>No</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* clear chat popup */}
                {showClearChatPopup && (
                    <div className="add-friend-overlay">
                        <div className="add-friend-card">
                            <div className="popup-header">
                                <h2>Clear Chat</h2>
                                <button className="close-btn" onClick={() => setShowClearChatPopup(false)}>
                                    <i className="fas fa-times"></i>
                                </button>
                            </div>

                            <p className="logout-prompt-text">
                                Are you sure you want to clear all chat messages with{' '}
                                <span style={{ color: 'var(--primary-light)', fontWeight: '500' }}>
                                    {activeChatUser?.username || activeChatUser?.email}
                                </span>
                                ?
                            </p>

                            <div className="logout-button-wrapper">
                                <button className="reject-btn" onClick={async () => {
                                    await handleClearChat();
                                    setShowClearChatPopup(false);
                                }}>
                                    Yes
                                </button>
                                <button className="accept-btn" onClick={() => setShowClearChatPopup(false)}>
                                    No
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* remove friend popup */}
                {showRemoveFriendPopup && (
                    <div className="add-friend-overlay">
                        <div className="add-friend-card">
                            <div className="popup-header">
                                <h2>Remove Friend</h2>

                                <button className="close-btn" onClick={() => setShowRemoveFriendPopup(false)}>
                                    <i className="fas fa-times"></i>
                                </button>

                            </div>

                            <p className="logout-prompt-text">
                                Are you sure to remove{' '}
                                <span style={{ color: 'var(--primary-light)', fontWeight: '500' }}>
                                    {activeChatUser?.username || activeChatUser?.email}
                                </span>{' '}
                                from your friend list?
                            </p>

                            <div className="logout-button-wrapper">
                                <button className="reject-btn" onClick={handleRemoveFriend}>Yes</button>
                                <button className="accept-btn" onClick={() => setShowRemoveFriendPopup(false)}>No</button>
                            </div>

                        </div>
                    </div>
                )}

                {/* change username popup */}
                {showChangeUsernamePopup && (
                    <div className="add-friend-overlay">
                        <div className="add-friend-card">
                            <div className="popup-header">
                                <h2>Change Username</h2>

                                <button className="close-btn" onClick={() => setShowChangeUsernamePopup(false)}>
                                    <i className="fas fa-times"></i>
                                </button>
                            </div>

                            <div className="change-username-form">
                                <input
                                    id="new-username"
                                    type="text"
                                    value={newUsername}
                                    onChange={(e) => setNewUsername(e.target.value)}
                                    placeholder="Enter new username"
                                    className="input-field"
                                />

                                <input
                                    id="current-password"
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    className="input-field"
                                />
                            </div>

                            <div className="logout-button-wrapper">
                                <button className="reject-btn" onClick={() => setShowChangeUsernamePopup(false)}>Cancel</button>
                                <button className="accept-btn" onClick={handleChangeUsername}>Change</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* change password popup */}
                {showChangePasswordPopup && (
                    <div className="add-friend-overlay">
                        <div className="add-friend-card">
                            <div className="popup-header">
                                <h2>Change Password</h2>
                                <button className="close-btn" onClick={() => setShowChangePasswordPopup(false)}>
                                    <i className="fas fa-times"></i>
                                </button>
                            </div>

                            <div className="change-password-form">
                                <input
                                    type="password"
                                    placeholder="Current Password"
                                    className="popup-input"
                                    value={currentPasswordForNewPassword}
                                    onChange={(e) => setCurrentPasswordForNewPassword(e.target.value)}
                                />
                                <input
                                    type="password"
                                    placeholder="New Password"
                                    className="popup-input"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                />
                                <input
                                    type="password"
                                    placeholder="Confirm New Password"
                                    className="popup-input"
                                    value={confirmNewPassword}
                                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                                />
                            </div>

                            <div className="logout-button-wrapper">
                                <button className="reject-btn" onClick={() => setShowChangePasswordPopup(false)}>Cancel</button>
                                <button className="accept-btn" onClick={handleChangePassword}>Change</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* profile details popup */}
                {showProfilePopup && (
                    <div className="add-friend-overlay">
                        <div className="add-friend-card">
                            <div className="popup-header">
                                <h2>Profile Details</h2>
                                <button className="close-btn" onClick={() => setShowProfilePopup(false)}>
                                    <i className="fas fa-times"></i>
                                </button>
                            </div>


                            <div className="details-container">
                                <div className="profile-field">
                                    <label>Username:</label>
                                    <span>{auth.currentUser?.displayName || "N/A"}</span>
                                </div>
                                <div className="profile-field">
                                    <label>Email:</label>
                                    <span>{auth.currentUser?.email}</span>
                                </div>
                                <div className="profile-field">
                                    <label>Account Created:</label>
                                    <span>{new Date(auth.currentUser?.metadata.creationTime).toLocaleDateString()}</span>
                                </div>
                            </div>

                            <div className="logout-button-wrapper">
                                <button className="reject-btn" onClick={() => setShowProfilePopup(false)}>Close</button>
                            </div>

                        </div>
                    </div>
                )}

                {/* Main App Container */}
                <div className="app-container">

                    <div className="panel-container">

                        <div className="left-panel">

                            <div className="search-container">

                                <button className="requests-btn" onClick={() => setShowRequestsPopup(true)}>
                                    <i className="fas fa-user-friends"></i> Requests
                                </button>

                                <button className="add-friend-btn" onClick={() => setShowAddFriendPopup(true)}>
                                    <i className="fas fa-user-plus"></i> Add Friend
                                </button>

                            </div>

                            <div className="friends-container">

                                <Friends
                                    onFriendClick={handleFriendClick}
                                    selectedFriend={activeChatUser}
                                    refreshTrigger={friendRefreshToggle}
                                    setRefreshTrigger={setFriendRefreshToggle}
                                />

                            </div>

                            <div className="set-log-container">
                                <div className="settings-wrapper">
                                    <button
                                        title="Settings"
                                        className="settings-button"
                                        onClick={() => setShowSettingsDropdown((prev) => !prev)}
                                    >
                                        <i className="fas fa-cog"></i>
                                    </button>

                                    {showSettingsDropdown && (
                                        <div className="settings-dropdown">
                                            <button className="dropdown-option" onClick={() => {
                                                setShowSettingsDropdown(false);
                                                setShowChangeUsernamePopup(true);
                                            }}>
                                                <i className="fas fa-user-edit"></i> Change Username
                                            </button>
                                            <button className="dropdown-option" onClick={() => {
                                                setShowSettingsDropdown(false);
                                                setShowChangePasswordPopup(true);
                                            }}>
                                                <i className="fas fa-key"></i> Change Password
                                            </button>
                                            <button
                                                className="dropdown-option"
                                                onClick={() => {
                                                    setShowSettingsDropdown(false);
                                                    setShowProfilePopup(true);
                                                }}
                                            >
                                                <i className="fas fa-user-circle"></i> Profile Details
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <button
                                    title="Logout"
                                    className="logout-button"
                                    onClick={() => setShowLogoutPopup(true)}
                                >
                                    <i className="fas fa-sign-out-alt"></i>
                                </button>
                            </div>

                        </div>

                        <div className="right-panel">

                            <div className="profile-details-container">
                                {activeChatUser ? (
                                    <div className="prof-container">

                                        <i className="fas fa-user user-icon"></i>

                                        <div className="usnm-status-container">
                                            <p>{activeChatUser.username || activeChatUser.email}</p>
                                            {/* Display online/offline status */}
                                            <p className={`status-text ${userStatus === "online" ? "online" : "offline"}`}>
                                                {userStatus === "online" ? "Online" : "Offline"}
                                            </p>
                                        </div>

                                    </div>
                                ) : (
                                    <></>
                                    // <p>Select a friend to chat</p>
                                )}

                                {activeChatUser && friendIds.includes(activeChatUser.id) && (
                                    <div className="misc-buttons">
                                        <button
                                            className="remove-friend-btn"
                                            title="Clear Chat"
                                            onClick={() => setShowClearChatPopup(true)}
                                        >
                                            <i className="fas fa-trash-alt"></i>
                                        </button>


                                        <button
                                            className="remove-friend-btn"
                                            title="Remove Friend"
                                            onClick={() => setShowRemoveFriendPopup(true)}
                                        >
                                            <i className="fas fa-user-minus"></i>
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="chat-container">

                                {chatId ? (
                                    <ChatBox chatId={chatId} />
                                ) : (
                                    <div className="no-chat-selected">
                                        <p>No chat selected</p>
                                    </div>
                                )}

                            </div>

                            <div className="message-field-container">

                                <input
                                    type="text"
                                    placeholder="Type a message..."
                                    value={messageText}
                                    onChange={handleInputChange}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleSendMessage();
                                    }}
                                />

                                <button title="Send" onClick={handleSendMessage}>
                                    <i className="fas fa-paper-plane"></i>
                                </button>

                            </div>
                        </div>

                    </div>

                </div>

            </div>

        </>

    );

}

export default HomePage;
