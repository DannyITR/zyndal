import { createContext, useContext, useState, useCallback } from 'react'
import { loadStoredTheme, applyTheme } from './theme'

const ThemeContext = createContext(null)

// App-wide theme state — deliberately mirrors how i18n.js/react-i18next
// split "instantly apply this language" (i18n.changeLanguage, no network
// call) from "persist it to the account" (the profile form's own Save,
// via updateUserProfile). setTheme here is the same kind of instant,
// persistence-agnostic apply: it updates React state, the DOM's
// data-theme attribute, and localStorage, but never talks to the server —
// SettingsScreen.jsx's picker is what additionally calls
// updateThemePreference() when a logged-in user makes an explicit choice,
// and App.jsx's own effect calls this same setTheme (not that DB call) to
// sync a signed-in account's saved theme_preference onto a new device,
// exactly like its language_preference effect already does.
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(loadStoredTheme)

  const setTheme = useCallback((next) => {
    applyTheme(next)
    setThemeState(next)
  }, [])

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
