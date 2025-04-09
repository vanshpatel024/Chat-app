import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db, auth } from './Firebase';
import "./StyleSheets/Friends.css"

function Friends({ onFriendClick }) {
  const [users, setUsers] = useState([]);
  const currentUserId = auth.currentUser?.uid;

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersRef = collection(db, "users");
        const querySnapshot = await getDocs(usersRef);
        const userList = [];
        querySnapshot.forEach((doc) => {
          if (doc.id !== currentUserId) {
            userList.push({ id: doc.id, ...doc.data() });
          }
        });
        setUsers(userList);
      } catch (err) {
        console.error("Failed to fetch users:", err);
      }
    };

    fetchUsers();
  }, [currentUserId]);

  return (
    <div className="friends-list">
      {users.map((user) => (
        <div key={user.id} className="friend-card" onClick={() => onFriendClick(user)}>
          <p>{user.username || user.email}</p>
        </div>
      ))}
    </div>
  );
}

export default Friends;
