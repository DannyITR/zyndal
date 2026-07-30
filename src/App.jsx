import { useEffect, useState } from 'react'
import { getCurrentUser, clearSession, setSessionExpiredHandler } from './lib/storage'
import LandingPage from './components/landing/LandingPage'
import AuthScreen from './components/auth/AuthScreen'
import OAuthCallbackScreen from './components/auth/OAuthCallbackScreen'
import VerifyEmailScreen from './components/auth/VerifyEmailScreen'
import StudentFlow from './components/student/StudentFlow'
import ParentDashboard from './components/parent/ParentDashboard'
import InstallPrompt from './components/shared/InstallPrompt'
import './App.css'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showLanding, setShowLanding] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  // No client-side router in this app — /auth/callback is the one path
  // that has to survive a hard browser navigation (Google/Facebook redirect
  // the whole page back to it, not a client-side transition), so it's
  // checked directly against window.location instead of being another
  // piece of in-memory screen state. See vercel.json for the rewrite that
  // makes a direct hit on this path serve index.html instead of 404ing.
  const [isOAuthCallback, setIsOAuthCallback] = useState(() => window.location.pathname === '/auth/callback')
  // Same rationale as isOAuthCallback above — an email verification link
  // has to survive a hard browser navigation too, and most people clicking
  // it aren't logged in on that device, so this is checked (and rendered)
  // before anything waits on getCurrentUser().
  const [isVerifyPage, setIsVerifyPage] = useState(() => window.location.pathname === '/verify')

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

  // Clears the /auth/callback URL either way (success or cancel) so a
  // refresh afterward doesn't re-run the OAuth exchange against a
  // now-consumed/expired code.
  function finishOAuthCallback(nextUser) {
    window.history.replaceState({}, '', '/')
    setIsOAuthCallback(false)
    if (nextUser) {
      setUser(nextUser)
      // The mount effect's getCurrentUser() call runs regardless of which
      // screen is shown, including while this callback screen is up — for
      // a brand-new account it resolves quickly (no session existed yet)
      // and sets showLanding=true well before this callback fires. Render
      // order checks showLanding before user, so without resetting it
      // here too, a successful sign-in would still land on the marketing
      // page instead of the dashboard. See finishVerify below for the
      // same fix, needed for the same reason.
      setShowLanding(false)
    } else {
      setShowLanding(false)
      setAuthMode('login')
    }
  }

  // Same shape as finishOAuthCallback above, for the /verify path — see
  // its comment for why setShowLanding(false) is required whenever a real
  // user is being set, not just for the "no user" branch.
  function finishVerify(nextUser) {
    window.history.replaceState({}, '', '/')
    setIsVerifyPage(false)
    if (nextUser) {
      setUser(nextUser)
      setShowLanding(false)
    }
  }

  if (isVerifyPage) {
    return <VerifyEmailScreen onVerified={finishVerify} />
  }

  if (isOAuthCallback) {
    return <OAuthCallbackScreen onAuth={finishOAuthCallback} onCancel={() => finishOAuthCallback(null)} />
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

  // Teacher accounts share ParentDashboard with parent accounts for now —
  // see api/_lib/parentHandler.js, which authorizes both the same way.
  // Class-specific teacher features are a future session.
  if (user.account_type === 'parent' || user.account_type === 'teacher') {
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
