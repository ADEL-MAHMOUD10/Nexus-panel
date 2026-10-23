import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'
import { NotificationProvider } from './context/NotificationContext'
import { ToastContainer } from './components/ToastContainer'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NotificationProvider>
      <App />
      <ToastContainer />
    </NotificationProvider>
  </StrictMode>,
)
