import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  getDoc,
  doc,
} from "firebase/firestore";
import { db, auth } from "./Firebase";
import "./StyleSheets/Friends.css";

function Friends({ onFriendClick, selectedFriend, refreshTrigger }) {

  const [users, setUsers] = useState([]);
  const [lastMessages, setLastMessages] = useState({});
  const currentUserId = auth.currentUser?.uid;

  useEffect(() => {
    const fetchFriendsAndMessages = async () => {
      try {
        const friendsRef = collection(db, "users", currentUserId, "friends");
        const friendsSnapshot = await getDocs(friendsRef);
  
        const friendIds = friendsSnapshot.docs.map(doc => doc.id);
        const friendData = [];
  
        for (const id of friendIds) {
          const userDoc = await getDoc(doc(db, "users", id));
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
  }, [currentUserId, selectedFriend, refreshTrigger]);
  
  return (
    <div className="friends-list">
      {users.map((user) => (
        <div
          key={user.id}
          className="friend-card"
          onClick={() => onFriendClick(user)}
        >
          <i className="fas fa-user user-icon"></i>
          <div className="user-info">
            <div className="user-name">{user.username || user.email}</div>
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
