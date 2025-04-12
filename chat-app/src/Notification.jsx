import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import './StyleSheets/Notification.css';

const NotificationContext = createContext();

export const useNotification = () => useContext(NotificationContext);

export function NotificationProvider({ children }) {
    const [message, setMessage] = useState('');
    const [visible, setVisible] = useState(false);
    const queueRef = useRef([]);
    const isProcessing = useRef(false);
    const lastMessage = useRef(null);

    const processQueue = () => {
        if (isProcessing.current || queueRef.current.length === 0) return;
    
        const nextMessage = queueRef.current.shift();
        
        //basic auto login notification fix (only showing once)
        if (lastMessage.current === "Auto Login Successful!" && nextMessage === "Auto Login Successful!") {
            processQueue();
            return;
        }
    
        lastMessage.current = nextMessage;
    
        isProcessing.current = true;
        setMessage(nextMessage);
        setVisible(true);
    
        setTimeout(() => {
            setVisible(false);
            setTimeout(() => {
                isProcessing.current = false;
                processQueue(); // Continue to next
            }, 500); // Optional: transition cooldown
        }, 3000); // Notification display duration
    };

    const showNotification = (msg) => {
        queueRef.current.push(msg);
        processQueue();
    };
    
    return (
        <NotificationContext.Provider value={{ showNotification }}>
            {children}
            <div className={`notification ${visible ? 'show' : ''}`}>
                {message}
            </div>
        </NotificationContext.Provider>
    );
}