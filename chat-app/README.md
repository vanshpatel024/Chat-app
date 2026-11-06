# Real-Time Chat Engine

## Overview
This project is a real-time, 1:1 messaging platform architected as a serverless Single Page Application (SPA). It resolves the problem of high-latency communication by utilizing a reactive NoSQL data model that synchronizes state across clients via persistent socket-like connections. The system handles authentication, real-time message broadcasting, typing state propagation, and friend-relation management without a dedicated backend server.

## Architecture
The system follows a client-side heavy architecture leveraging Backend-as-a-Service (BaaS) for persistence and authentication.

- **Frontend Tier**: React 19 application managed by Vite. It handles state via the Context API and custom hooks, ensuring a decoupled UI layer.
- **Backend Tier (BaaS)**: Google Firebase providing:
    - **Authentication Service**: Identity management and OAuth 2.0 flow.
    - **Cloud Firestore**: Real-time Document Database for message persistence and state synchronization.
- **Data Flow Logic**:
    1. **Initialization**: Client authenticates via Firebase Auth.
    2. **Subscription**: Component lifecycle triggers `onSnapshot` listeners on specific Firestore document paths (messages, typing status).
    3. **Ingestion**: User input triggers atomic writes to Firestore sub-collections.
    4. **Propagation**: Firestore pushes binary updates over WebSockets (internal implementation) to all subscribed peers.
    5. **Reconciliation**: The React state updates, triggering an optimized VDOM re-render.

## Tech Stack
- **Framework**: React 19
- **Build Tool**: Vite
- **Database/Auth**: Firebase 11 (Firestore, Auth)
- **State Management**: React Hooks (useState, useEffect, useRef), Loading Context
- **Routing**: React Router 7
- **UI/UX**: Framer Motion, Vanilla CSS (Custom properties/variables)
- **Utilities**: Lodash (Debouncing/Utilities)

## Features
- **Deterministic 1:1 Chat Channels**: Chat IDs are generated using a sorted UID combination strategy `[uid1, uid2].sort().join('_')`, ensuring unique and predictable routes for private conversations.
- **Sub-Atomic Real-Time Messaging**: Message propagation occurs via Firestore listeners, providing near-instantaneous updates across clients.
- **Reactive Typing Indicators**: Propagates user activity states using a debounced heartbeat pattern to minimize database write operations.
- **Relationship Management**: A friend request system utilizing sub-collections with mutual-acceptance logic for secure interpersonal connections.
- **State-Aware UI Segments**: Dynamic time-dividers in chat threads calculated based on message timestamp deltas (10-minute threshold).
- **Graceful Connection Handling**: Automatic user status management ("online"/"offline") via `beforeunload` events and manual triggers.

## Folder Structure
```bash
src/
├── assets/             # Static assets (images, icons)
├── StyleSheets/        # Modular CSS components
├── Firebase.js         # Service initialization and configuration
├── FirestoreUtils.jsx  # Abstracted database CRUD operations
├── App.jsx             # Core routing and navigation logic
├── main.jsx            # Application entry point
├── LoadingContext.jsx  # Global loading state management
├── ProtectedRoute.jsx  # Authentication gatekeeper component
├── Notification.jsx    # Global toast/alert system
├── HomePage.jsx        # Dashboard and friend management logic
├── ChatBox.jsx         # Messaging interface and real-time listeners
├── Friends.jsx         # Contact list rendering logic
├── LoginPage.jsx       # Identity provider entry point
└── CNAPage.jsx         # User registration interface
```

## How It Works
1. **Authentication Lifecycle**: User logs in; `ProtectedRoute` validates the `AuthState` observer.
2. **Contact Selection**: Selecting a friend generates a deterministic `chatId`.
3. **Synchronization Pipeline**:
    - `ChatBox` mounts → Establishes `onSnapshot` listener on `chats/{chatId}/messages`.
    - `onSnapshot` listener established on `chats/{chatId}/typingStatus`.
4. **Input Processing**:
    - Input event → Trigger `updateTypingStatus(true)` → Debounce 2s → `updateTypingStatus(false)`.
5. **Message Submission**: `addDoc` to `messages` sub-collection with a `serverTimestamp` for consistent ordering across timezones.

## Key Implementation Details
- **Real-Time Subscription Pattern**: Uses `onSnapshot` with meticulous cleanup in `useEffect` return blocks to prevent memory leaks and redundant Firestore billing.
- **Deterministic Resource Routing**: Avoiding central chat registries by deriving chat document IDs from sorted user UIDs, effectively reducing query complexity.
- **Scroll Management**: Implements `scrollIntoView` triggered by message state updates within a micro-task timeout to ensure the UI focuses on the latest content after DOM paint.
- **Persistence Logic**: Leverages `localStorage` as a secondary cache for credentials to improve perceived performance during initial load.

## Setup & Installation
```bash
# Clone the repository
git clone <repository-url>

# Install dependencies
npm install

# Configure Environment Variables
# Create a .env file and add your Firebase credentials:
# VITE_FIREBASE_API_KEY=...
# VITE_FIREBASE_AUTH_DOMAIN=...
# VITE_FIREBASE_PROJECT_ID=...
# etc.

# Run development server
npm run dev
```

## Usage
1. **Sign Up**: Create an account via the registration page.
2. **Add Friends**: Search for users by their exact username and send a request.
3. **Messaging**: Once a request is accepted, click the friend's name to open the real-time chat interface.
4. **Settings**: Modify username or password via the settings dropdown within the dashboard.

## Performance
- **Latency**: Firestore real-time updates typically propagate within 50-200ms depending on client network conditions.
- **Throughput**: Optimized for high-frequency small-packet data (text messages) with minimal payload overhead.
- **Reliability**: Leverages Firebase's offline persistence mechanism for resilient messaging in intermittent network environments.
