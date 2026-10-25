import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'
import { ThemeProvider } from './context/ThemeContext'
import { NotificationProvider } from './context/NotificationContext'
import { ConfirmProvider } from './context/ConfirmContext'
import { ToastContainer } from './components/ToastContainer'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <NotificationProvider>
        <ConfirmProvider>
          <App />
          <ToastContainer />
        </ConfirmProvider>
      </NotificationProvider>
    </ThemeProvider>
  </StrictMode>,
)
