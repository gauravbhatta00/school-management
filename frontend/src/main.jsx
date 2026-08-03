import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { ThemeProvider } from './context/ThemeContext'
import { Router } from './router'
import './index.css'
import 'react-calendar/dist/Calendar.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <Router>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              fontSize: '14px',
            },
            success: { iconTheme: { primary: '#10b981', secondary: 'var(--bg-card)' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: 'var(--bg-card)' } },
          }}
        />
      </Router>
    </ThemeProvider>
  </React.StrictMode>
)
