import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from './Firebase';
import { useNotification } from './Notification';
import "./StyleSheets/HomePage.css"
import Friends from './Friends';
import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp,
    collection,
    addDoc
} from "firebase/firestore";

import { debounce } from "lodash";

import { db } from "./Firebase";

import ChatBox from './Chatbox';

function HomePage() {
    const navigate = useNavigate();
    const { showNotification } = useNotification();

    const [activeChatUser, setActiveChatUser] = useState(null); // user object
    const [chatId, setChatId] = useState(null);

    const [messageText, setMessageText] = useState("");

    const currentUid = auth.currentUser.uid;

    const typingTimeout = useRef(null);
    const lastTypingState = useRef(false);


    //---------------------------------------------------------------------------------------------------------


    //clicking on a firend's button on the left panel
    const handleFriendClick = async (friendUser) => {
        setActiveChatUser(friendUser);
        const currentUid = auth.currentUser.uid;
        const friendUid = friendUser.id;

        // Generate consistent Chat ID
        const generatedChatId = [currentUid, friendUid].sort().join('_');
        setChatId(generatedChatId);

        // Optionally: Create chat document if it doesn't exist
        const chatRef = doc(db, "chats", generatedChatId);
        const chatDoc = await getDoc(chatRef);
        if (!chatDoc.exists()) {
            await setDoc(chatRef, {
                members: [currentUid, friendUid],
                createdAt: serverTimestamp()
            });
        }
    };

    const updateTypingStatus = async (isTyping) => {
        if (!chatId) return;

        // Avoid sending duplicate states
        if (lastTypingState.current === isTyping) return;

        lastTypingState.current = isTyping;

        const typingRef = doc(db, "chats", chatId, "typingStatus", "status");
        await setDoc(typingRef, {
            [currentUid]: isTyping,
        }, { merge: true });
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
                <div className="app-container">
                    <div className="panel-container">
                        <div className="left-panel">
                            <div className="search-container">

                            </div>
                            <div className="friends-container">
                                <Friends onFriendClick={(user) => handleFriendClick(user)} />
                            </div>
                            <div className="set-log-container">
                                <button className="settings-button">
                                    <i className="fas fa-cog"></i>
                                </button>
                                <button className="logout-button" onClick={handleLogout}>
                                    <i className="fas fa-sign-out-alt"></i>
                                </button>
                            </div>
                        </div>
                        <div className="right-panel">
                            <div className="profile-details-container">
                                {activeChatUser ? <p>{activeChatUser.username || activeChatUser.email}</p> : <p>Select a friend to chat</p>}
                            </div>
                            <div className="chat-container">
                                {chatId ? (
                                    <ChatBox chatId={chatId} />
                                ) : (
                                    <></>
                                    // <p>No chat selected</p>
                                )}
                            </div>
                            <div className="message-field-container">
                                <input
                                    type="text"
                                    placeholder="Type a message..."
                                    value={messageText}
                                    onChange={handleInputChange}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSendMessage();
                                    }}
                                />
                                <button onClick={handleSendMessage}>
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
