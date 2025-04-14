import React, { useEffect, useState, useRef } from "react";
import {
  collection,
  getDocs,
  query,
  updateDoc,
  orderBy,
  limit,
  getDoc,
  doc,
  onSnapshot
} from "firebase/firestore";
import { db, auth } from "./Firebase";
import "./StyleSheets/Friends.css";
import { AnimatePresence, motion } from "framer-motion";
import { useNotification } from "./Notification";

function Friends({ onFriendClick, selectedFriend, refreshTrigger, setRefreshTrigger }) {

  const [users, setUsers] = useState([]);
  const currentUserId = auth.currentUser?.uid;
  const listenersRef = React.useRef({});
  const { showNotification } = useNotification();

  //fetch friends and their last messages
  useEffect(() => {
    let unsubscribes = [];
    const localListeners = {};

    const fetchFriendsAndMessages = async () => {
      try {
        const friendsRef = collection(db, "users", currentUserId, "friends");
        const friendsSnapshot = await getDocs(friendsRef);

        const friendData = await Promise.all(
          friendsSnapshot.docs.map(async (docSnap) => {
            const friendId = docSnap.id;
            const userDocRef = doc(db, "users", friendId);

            // Real-time status listener
            const unsubscribe = onSnapshot(userDocRef, (snapshot) => {
              if (snapshot.exists()) {
                const status = snapshot.data().status;
                setUsers(prevUsers =>
                  prevUsers.map(user =>
                    user.id === friendId ? { ...user, status } : user
                  )
                );
              }
            });

            unsubscribes.push(unsubscribe);
            localListeners[friendId] = unsubscribe;

            // Static user info
            const userDoc = await getDoc(userDocRef);
            if (!userDoc.exists()) return null;

            const userInfo = { id: friendId, ...userDoc.data() };

            // Last message
            const chatId = [currentUserId, friendId].sort().join("_");
            const messagesRef = collection(db, "chats", chatId, "messages");
            const latestQuery = query(messagesRef, orderBy("timestamp", "desc"), limit(1));
            const latestSnapshot = await getDocs(latestQuery);
            const lastMessageDoc = latestSnapshot.docs[0];
            const lastMessage = lastMessageDoc?.data();

            userInfo.lastMessage = {
              text: lastMessage?.text || "",
              timestamp: lastMessage?.timestamp?.toMillis() || 0,
            };

            return userInfo;
          })
        );

        const filtered = friendData.filter(Boolean);
        filtered.sort((a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp);
        setUsers(filtered);
      } catch (err) {
        console.error("Error fetching friends:", err);
      }
    };

    if (currentUserId) fetchFriendsAndMessages();

    return () => {
      unsubscribes.forEach(unsub => unsub());
      Object.values(listenersRef.current).forEach(unsub => unsub());
      listenersRef.current = {};
    };
  }, [currentUserId, selectedFriend, refreshTrigger]);

  //realtime updates for last message and status
  useEffect(() => {
    if (!currentUserId){
      return;
    }

    users.forEach(user => {
      const friendId = user.id;
      const chatId = [currentUserId, friendId].sort().join("_");

      const messagesRef = collection(db, "chats", chatId, "messages");
      const latestQuery = query(messagesRef, orderBy("timestamp", "desc"), limit(1));

      const unsubMessage = onSnapshot(latestQuery, (snapshot) => {
        const doc = snapshot.docs[0];
        const data = doc?.data();

        if (!data) {
          return;
        }

        const newMessage = {
          text: data.text || "",
          timestamp: data.timestamp?.toMillis() || 0,
        };

        setUsers(prev => {
          const existing = prev.find(u => u.id === friendId);

          const isSameMessage =
            existing.lastMessage?.text === newMessage.text &&
            existing.lastMessage?.timestamp === newMessage.timestamp;

          if (isSameMessage) return prev; // No update if message is the same

          const updated = prev.map(u =>
            u.id === friendId ? { ...u, lastMessage: newMessage } : u
          );

          const sorted = [...updated].sort((a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp);
          setUsers(sorted);  // Re-sort after message update
          return sorted;
        });
      });

      listenersRef.current[friendId] = unsubMessage;
    });

    return () => {
      Object.values(listenersRef.current).forEach(unsub => unsub());
      listenersRef.current = {};
    };
  }, [currentUserId, users.map(u => u.id).join(",")]); // Ensure the effect runs when users change  

  //set online/offline status
  useEffect(() => {
    if (!currentUserId) return;

    const userDocRef = doc(db, "users", currentUserId);

    const setUserOnline = async () => {
      try {
        await updateDoc(userDocRef, { status: "online" });
      } catch (err) {
        console.error("Error setting online status:", err);
      }
    };

    const setUserOffline = async () => {
      try {
        await updateDoc(userDocRef, { status: "offline" });
      } catch (err) {
        console.error("Error setting offline status:", err);
      }
    };

    // Handle visibility change (user switches tabs or minimizes)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setUserOnline();
      } else {
        setUserOffline();
      }
    };

    // Set online when the component mounts
    setUserOnline();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", setUserOffline);
    window.addEventListener("unload", setUserOffline);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", setUserOffline);
      window.removeEventListener("unload", setUserOffline);
    };
  }, [currentUserId]);

  return (
    <div className="friends-list">
      <AnimatePresence>
        {users.map((user) => (
          <motion.div
            key={user.id}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{
              duration: 0.25,
              ease: "easeInOut",
            }}
            className={`friend-card ${user.status === "online" ? "friend-online" : ""}`}
            onClick={() => onFriendClick(user)}
          >
            <i className="fas fa-user user-icon"></i>
            <div className="user-info">
              <div className="user-name">{user.username || user.email}</div>
              <div className="last-message">
                {user.lastMessage?.text?.length > 0
                  ? user.lastMessage.text
                  : "No messages yet"}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );

}

export default Friends;
