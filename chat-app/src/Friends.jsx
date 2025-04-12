import React, { useEffect, useState } from "react";
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

function Friends({ onFriendClick, selectedFriend, refreshTrigger }) {

  const [users, setUsers] = useState([]);
  const [lastMessages, setLastMessages] = useState({});
  const currentUserId = auth.currentUser?.uid;

  useEffect(() => {
    let unsubscribes = [];

    const fetchFriendsAndMessages = async () => {
      try {
        const friendsRef = collection(db, "users", currentUserId, "friends");
        const friendsSnapshot = await getDocs(friendsRef);

        const friendIds = friendsSnapshot.docs.map(doc => doc.id);
        const friendData = [];

        for (const id of friendIds) {
          const userDocRef = doc(db, "users", id);

          // Real-time status listener
          const unsubscribe = onSnapshot(userDocRef, (snapshot) => {
            if (snapshot.exists()) {
              const status = snapshot.data().status;
              setUsers(prevUsers =>
                prevUsers.map(user =>
                  user.id === id ? { ...user, status } : user
                )
              );
            }
          });
          unsubscribes.push(unsubscribe);

          // Static data and last message
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            friendData.push({ id, ...userDoc.data() });

            const chatId = [currentUserId, id].sort().join("_");
            const messagesRef = collection(db, "chats", chatId, "messages");
            const latestQuery = query(messagesRef, orderBy("timestamp", "desc"), limit(1));
            const latestSnapshot = await getDocs(latestQuery);
            const lastMessage = latestSnapshot.docs[0]?.data()?.text || "";
            setLastMessages(prev => ({ ...prev, [id]: lastMessage }));
          }
        }

        setUsers(friendData);
      } catch (err) {
        console.error("Error fetching friends: ", err);
      }
    };

    if (currentUserId) fetchFriendsAndMessages();

    // Cleanup real-time listeners
    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [currentUserId, selectedFriend, refreshTrigger]);

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
      {users.map((user) => (
        <div
          key={user.id}
          className={`friend-card ${user.status === "online" ? "friend-online" : ""}`}
          onClick={() => onFriendClick(user)}
        >
          <i className="fas fa-user user-icon"></i>
          <div className="user-info">
            <div className="user-name">
              {user.username || user.email}
            </div>
            <div className="last-message">
              {lastMessages[user.id]?.length > 0
                ? lastMessages[user.id]
                : "No messages yet"}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

}

export default Friends;
