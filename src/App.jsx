import { useEffect, useState } from 'react'
import { getCurrentUser, clearSession, setSessionExpiredHandler } from './lib/storage'
import LandingPage from './components/landing/LandingPage'
import AuthScreen from './components/auth/AuthScreen'
import StudentFlow from './components/student/StudentFlow'
import ParentDashboard from './components/parent/ParentDashboard'
import InstallPrompt from './components/shared/InstallPrompt'
import './App.css'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showLanding, setShowLanding] = useState(false)
  const [authMode, setAuthMode] = useState('login')

  useEffect(() => {
    let cancelled = false
    getCurrentUser().then((u) => {
      if (cancelled) return
      setUser(u)
      // A visitor with no session lands on the marketing page first; a
      // returning logged-in user skips straight to their dashboard.
      setShowLanding(!u)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Fires from anywhere a /api/student or /api/questions call gets a 401
  // mid-session (session row deleted or expired while the user was active)
  // — see setSessionExpiredHandler in storage.js. Goes straight to the
  // login screen rather than the marketing landing page, since this only
  // fires for someone who was already logged in.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null)
      setShowLanding(false)
      setAuthMode('login')
    })
    return () => setSessionExpiredHandler(null)
  }, [])

  function handleLogout() {
    clearSession()
    setUser(null)
    setShowLanding(true)
  }

  function goToAuth(mode) {
    setAuthMode(mode)
    setShowLanding(false)
  }

  if (loading) {
    return (
      <div className="app-splash">
        <div className="app-splash-logo">
          <span className="app-splash-bolt">⚡</span>
          <span className="app-splash-text">Zyndal</span>
        </div>
      </div>
    )
  }

  // The logo only ever reaches this "go to landing" callback while logged
  // out (AuthScreen). Once logged in, clicking it resets to that role's own
  // home view instead — see StudentFlow/ParentDashboard's own handlers.
  if (showLanding) {
    return <LandingPage onSignUp={() => goToAuth('signup')} onLogIn={() => goToAuth('login')} />
  }

  if (!user) {
    return <AuthScreen initialMode={authMode} onAuth={setUser} onLogoClick={() => setShowLanding(true)} />
  }

  if (user.account_type === 'parent') {
    return (
      <>
        <ParentDashboard user={user} onLogout={handleLogout} onUserUpdate={setUser} />
        <InstallPrompt />
      </>
    )
  }

  return (
    <>
      <StudentFlow user={user} onLogout={handleLogout} onUserUpdate={setUser} />
      <InstallPrompt />
    </>
  )
}

export default App
