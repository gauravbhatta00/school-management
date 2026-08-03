/**
 * ThemeContext — light/dark UI theme, persisted to localStorage.
 * Applies the theme by setting data-theme on <html>; every color in
 * index.css is a CSS variable, so no other component needs to know
 * the theme exists.
 */

import React, { createContext, useState, useEffect, useCallback } from 'react'

export const ThemeContext = createContext(null)
const STORAGE_KEY = 'theme'

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'dark'
    } catch {
      return 'dark'
    }
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // localStorage may be unavailable (private mode) — theme just won't persist
    }
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
