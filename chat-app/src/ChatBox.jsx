import { useEffect, useRef, useState } from "react";
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

    return (
        <div className="chat-box">

            <div className="chat-messages">

                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`chat-message ${msg.sender === auth.currentUser.uid ? "sent" : "received"
                            }`}
                    >
                        {msg.text}
                    </div>
                ))}

                {typing && <p className="typing-indicator">Typing...</p>}
                
                <div ref={bottomRef} />

            </div>
        </div>
    );
}

export default ChatBox;
