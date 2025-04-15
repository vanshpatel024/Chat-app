import { use, useEffect, useRef, useState } from "react";
import React from "react";
import {
    doc,
    collection,
    query,
    orderBy,
    onSnapshot,
    deleteDoc,
} from "firebase/firestore";
import { db, auth } from "./Firebase";
import "./StyleSheets/ChatBox.css";
import { useNotification } from "./Notification";

function ChatBox({ chatId }) {
    const [messages, setMessages] = useState([]);
    const bottomRef = useRef(null);

    const [typing, setTyping] = useState(false);

    const { showNotification } = useNotification();

    const [hoveredMsgId, setHoveredMsgId] = useState(null);
    const [fadingOut, setFadingOut] = useState(false);
    const [isHoveringDeleteButton, setIsHoveringDeleteButton] = useState(false);
    const timeoutRef = useRef(null);


    //---------------------------------------------------------------------------------------------------------


    //check if mouse is hovering over delete button
    const handleMouseEnter = (id) => {
        clearTimeout(timeoutRef.current);
        setFadingOut(false); // Stop any ongoing fade-out when hovering on the message
        setHoveredMsgId(id);
    };

    //mouse leave check for delete button
    const runCheckHoverTimeout = () => {
        const timeout = setTimeout(() => {
            if (!isHoveringDeleteButton) {
                setFadingOut(true);
                timeoutRef.current = setTimeout(() => {
                    setHoveredMsgId(null);
                    setFadingOut(false);
                }, 500);
            }
        }, 1000);
    
        return timeout;
    };

    useEffect(() => {
        const timeout = runCheckHoverTimeout();
        return () => clearTimeout(timeout);
    }, [isHoveringDeleteButton]);
    
    
    useEffect(() => {
        if (!chatId) return;

        // Subscribe to messages
        const q = query(
            collection(db, "chats", chatId, "messages"),
            orderBy("timestamp")
        );
        const unsubscribeMessages = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));
            setMessages(msgs);

            setTimeout(() => {
                bottomRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 100);
        });

        // Subscribe to typing status
        const typingRef = doc(db, "chats", chatId, "typingStatus", "status");
        const unsubscribeTyping = onSnapshot(typingRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const friendId = chatId.split("_").find(id => id !== auth.currentUser.uid);
                setTyping(data[friendId] || false);
            }
        });

        // Cleanup both subscriptions
        return () => {
            unsubscribeMessages();
            unsubscribeTyping();
        };
    }, [chatId]);

    const shouldShowTimeDivider = (prevMsg, currentMsg) => {
        if (!prevMsg || !prevMsg.timestamp || !currentMsg.timestamp) return true;

        const prevTime = prevMsg.timestamp.toDate();
        const currentTime = currentMsg.timestamp.toDate();
        const diffInMinutes = Math.abs((currentTime - prevTime) / 60000);

        return diffInMinutes > 10;
    };

    const handleDeleteMessage = async (messageId) => {
        try {
            await deleteDoc(doc(db, "chats", chatId, "messages", messageId));
            showNotification("Message deleted successfully");
        } catch (error) {
            console.error("Error deleting message: ", error);
        }
    };

    return (
        <div className="chat-box">
            <div className="chat-messages">

                {messages.map((msg, index) => {
                    const showTime = shouldShowTimeDivider(messages[index - 1], msg);
                    const timestamp = msg.timestamp?.toDate?.();
                    const formattedTime = timestamp?.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                    });

                    const isSender = msg.sender === auth.currentUser.uid;
                    const isHovered = hoveredMsgId === msg.id || hoveredMsgId === index;

                    return (
                        <React.Fragment key={msg.id || index}>
                            {showTime && timestamp && (
                                <div className="time-divider">
                                    {new Intl.DateTimeFormat('en-US', {
                                        weekday: 'short',
                                        day: '2-digit',
                                        month: 'short',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: true
                                    }).format(timestamp).replace(/,/g, '')}
                                </div>
                            )}

                            <div
                                className={`chat-message ${isSender ? "sent" : "received"}`}
                                onMouseEnter={() => handleMouseEnter(msg.id || index)}
                                onMouseLeave={() => {
                                    runCheckHoverTimeout();
                                }}
                            >

                                <div className="message-text">{msg.text}</div>

                                {timestamp && (
                                    <div className={`message-time ${msg.sender === auth.currentUser.uid ? "sent" : "received"}`}>
                                        {formattedTime}
                                    </div>
                                )}

                                {isSender && isHovered && (
                                    <button
                                        className={`delete-msg-button ${fadingOut ? 'fade-out' : ''}`}
                                        onClick={() => handleDeleteMessage(msg.id)}
                                        onMouseEnter={() => setIsHoveringDeleteButton(true)}
                                        onMouseLeave={() => {
                                            setIsHoveringDeleteButton(false);
                                            runCheckHoverTimeout();
                                        }}
                                    >
                                        <i className="fas fa-trash"></i>
                                    </button>
                                )}

                            </div>

                        </React.Fragment>
                    );
                })}

                {typing && <p className="typing-indicator">Typing...</p>}

                <div ref={bottomRef} />

            </div>
        </div>
    );
}

export default ChatBox;
