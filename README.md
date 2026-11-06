# Quick Chat — Realtime Web Chat App

Quick Chat is a sleek, responsive, real-time chat web application built using React + Vite on the frontend and Firebase on the backend. It provides seamless real-time communication with a modern, minimal glass-inspired interface designed for smooth and intuitive user interaction.

## Live Demo
https://chat-app-psi-seven-47.vercel.app/

---

## Tech Stack

### Frontend
- React
- Vite
- CSS (Custom glassmorphism theme)

### Backend
- Firebase Authentication
- Firestore Database
- Real-time listeners

---

## Features

### Authentication
- Email and password registration
- Google sign-in
- Password reset functionality
- Update account details (username and password)

### Real-Time Chat System
- Instant messaging with real-time updates
- Message timestamps (visible on hover)
- Delete individual messages
- Clear entire conversations
- Typing indicators
- Online/offline presence tracking

### Friends Management
- Add and remove friends
- Search users
- Real-time online status indicators
- Unread message notification badges

### UI/UX
- Smooth transitions and subtle animations
- Modern glass-style interface
- Fully responsive design (desktop, tablet, mobile)

---

## Getting Started

```bash
# Clone the repository
git clone https://github.com/vanshpatel024/Chat-app.git

# Navigate into the project directory
cd Chat-app

# Configure environment variables (copy .env.example)
cp .env.example chat-app/.env
# Fill in your Firebase configuration keys in chat-app/.env

# Install dependencies (from root or chat-app)
cd chat-app
npm install

# Start the development server
npm run dev

# Run automated tests
npm test
```

## 🌐 Production Deployment (Vercel)

To deploy to Vercel:

1. Import the repository into **Vercel**.
2. **Framework Preset**: Vite
3. **Root Directory**: `chat-app` (or leave as `/` — root `vercel.json` and `package.json` handle both).
4. Add the following **Environment Variables** in the Vercel Dashboard (**Project Settings → Environment Variables**):
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_MEASUREMENT_ID`
5. Click **Deploy**.
