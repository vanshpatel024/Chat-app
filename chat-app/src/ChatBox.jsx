import { useEffect, useRef, useState } from "react";
import React from "react";
import {
    doc,
    collection,
    query,
    orderBy,
    onSnapshot
} from "firebase/firestore";
import { db, auth } from "./Firebase";
import "./StyleSheets/ChatBox.css";

function ChatBox({ chatId }) {
    const [messages, setMessages] = useState([]);
    const bottomRef = useRef(null);

    const [typing, setTyping] = useState(false);


    //---------------------------------------------------------------------------------------------------------

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

    return (
        <div className="chat-box">
            <div className="chat-messages">
    
                {messages.map((msg, index) => {
                    const showTime = shouldShowTimeDivider(messages[index - 1], msg);
                    const timestamp = msg.timestamp?.toDate?.(); // safe call
                    const formattedTime = timestamp?.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
    
                    return (
                        <React.Fragment key={msg.id || index}>
                            {showTime && timestamp && (
                                <div className="time-divider">
                                    {timestamp.toLocaleString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: true,
                                        weekday: 'short',
                                        day: '2-digit',
                                        month: 'short',
                                    })}
                                </div>
                            )}
    
                            <div className={`chat-message ${msg.sender === auth.currentUser.uid ? "sent" : "received"}`}>
                                <div className="message-text">{msg.text}</div>
    
                                {timestamp && (
                                    <div className={`message-time ${msg.sender === auth.currentUser.uid ? "sent" : "received"}`}>
                                        {formattedTime}
                                    </div>
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
