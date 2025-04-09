import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './StyleSheets/index.css'
import { NotificationProvider } from './Notification'
import { LoadingProvider } from './LoadingContext';


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LoadingProvider>
      <NotificationProvider>
        <App />
      </NotificationProvider>
    </LoadingProvider>
  </StrictMode>,
)
