import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "./Firebase";
import { useNotification } from "./Notification";
import "./StyleSheets/HomePage.css";
import ChatBox from "./ChatBox.jsx";
import Friends from "./Friends";
import {
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
import { db } from "./Firebase";

function HomePage() {
    const navigate = useNavigate();
    const { showNotification } = useNotification();

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

    const [userStatus, setUserStatus] = useState(activeChatUser?.status || "offline");


    //---------------------------------------------------------------------------------------------------------


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

    // Cancel pending debounce calls on cleanup
    useEffect(() => {
        return () => {
            if (typingTimeout.current) {
                clearTimeout(typingTimeout.current);
            }
        };
    }, [chatId]);

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
                                />

                            </div>

                            <div className="set-log-container">

                                <button title="Settings" className="settings-button">
                                    <i className="fas fa-cog"></i>
                                </button>

                                <button title="Logout" className="logout-button" onClick={() => setShowLogoutPopup(true)}>
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
                                    <button
                                        className="remove-friend-btn"
                                        title="Remove Friend"
                                        onClick={() => setShowRemoveFriendPopup(true)}
                                    >
                                        <i className="fas fa-user-minus"></i>
                                    </button>
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
