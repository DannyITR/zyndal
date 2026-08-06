import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getCurrentUser, clearSession, setSessionExpiredHandler, setPremiumRequiredHandler, lookupParentCode } from './lib/storage'
import { languageCodeForPreference } from './lib/i18n'
import LandingPage from './components/landing/LandingPage'
import AuthScreen from './components/auth/AuthScreen'
import OAuthCallbackScreen from './components/auth/OAuthCallbackScreen'
import VerifyEmailScreen from './components/auth/VerifyEmailScreen'
import ResetPasswordScreen from './components/auth/ResetPasswordScreen'
import SubscriptionSuccessScreen from './components/subscription/SubscriptionSuccessScreen'
import SubscriptionCancelledScreen from './components/subscription/SubscriptionCancelledScreen'
import StudentFlow from './components/student/StudentFlow'
import ParentDashboard from './components/parent/ParentDashboard'
import TeacherFlow from './components/teacher/TeacherFlow'
import InstallPrompt from './components/shared/InstallPrompt'
import UpgradeModal from './components/shared/UpgradeModal'
import AdminApp from './components/admin/AdminApp'
import './App.css'

function App() {
  const { i18n } = useTranslation()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showLanding, setShowLanding] = useState(false)
  // Defaults straight to the signup form for a visitor arriving via a
  // parent's invite link (?parent_code=...) — see inviteParams below.
  const [authMode, setAuthMode] = useState(() => (new URLSearchParams(window.location.search).get('parent_code') ? 'signup' : 'login'))
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
  // Same rationale — Stripe Checkout's success_url/cancel_url (see
  // api/stripe/create-checkout.js) hard-navigate the browser away to Stripe
  // and back, same as an OAuth redirect. See vercel.json for the matching
  // rewrites.
  const [isSubscriptionSuccessPage, setIsSubscriptionSuccessPage] = useState(() => window.location.pathname === '/subscription/success')
  const [isSubscriptionCancelledPage, setIsSubscriptionCancelledPage] = useState(() => window.location.pathname === '/subscription/cancelled')
  // No setter — unlike isVerifyPage/isOAuthCallback, nothing here ever
  // calls back into App's own state; ResetPasswordScreen never logs
  // anyone in (see its own comment), so there's no user object to hand
  // back and no reason to leave this page programmatically.
  const [isResetPasswordPage] = useState(() => window.location.pathname === '/reset-password')
  // /admin is a fully separate auth surface (admin token, not a user
  // session — see src/lib/adminApi.js) and never appears in the main app's
  // navigation. Checked first, before the regular getCurrentUser()/loading
  // flow even starts rendering anything for it.
  // Prefix match (not exact) — the admin panel now has its own sub-routes
  // (e.g. /admin/users/:id for the Edit User page), all handled by
  // AdminApp's own internal routing, not this component's.
  const [isAdminPage] = useState(() => window.location.pathname.startsWith('/admin'))

  // A parent's "Add Child" invite link (Share Code tab, or the invite
  // email's Create-my-account button) — read once on mount, same pattern
  // as the other URL-driven states above. inviteParentUsername starts null
  // and is filled in async (lookup-parent-code.js is public, no session
  // needed yet) purely for the "@[parent] invited you!" banner text;
  // signup itself only ever needs the code, not the username.
  const [inviteParams] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const parentCode = params.get('parent_code')
    if (!parentCode) return null
    return { parentCode, email: params.get('email') || '' }
  })
  const [inviteParentUsername, setInviteParentUsername] = useState(null)
  const [showGlobalUpgradeModal, setShowGlobalUpgradeModal] = useState(false)

  useEffect(() => {
    if (!inviteParams) return
    let cancelled = false
    lookupParentCode(inviteParams.parentCode)
      .then(({ username }) => {
        if (!cancelled) setInviteParentUsername(username)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [inviteParams])

  useEffect(() => {
    let cancelled = false
    getCurrentUser().then((u) => {
      if (cancelled) return
      setUser(u)
      // A visitor with no session lands on the marketing page first; a
      // returning logged-in user skips straight to their dashboard. A
      // visitor arriving via a parent's invite link skips the marketing
      // page too, straight to signup — see inviteParams above.
      setShowLanding(!u && !inviteParams)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [inviteParams])

  // Syncs i18next to whichever account is current, covering every path
  // that ever calls setUser (initial load, login/signup, OAuth, email
  // verification, Settings save) from one place instead of each of them
  // needing to remember to do it. Before login, the language detector's own
  // localStorage/browser fallback (see src/lib/i18n.js) already applies —
  // this only fires once a real user object exists.
  //
  // Deliberately NOT depending on `i18n` here (it's a stable singleton for
  // the app's whole lifetime, imported once from src/lib/i18n.js) — adding
  // it caused this effect to re-fire immediately after any in-place
  // i18n.changeLanguage() call elsewhere (e.g. SettingsScreen.jsx's
  // instant-preview on the language dropdown), stomping that change right
  // back to whatever's still saved on `user` before the form is submitted.
  useEffect(() => {
    if (!user?.language_preference) return
    i18n.changeLanguage(languageCodeForPreference(user.language_preference))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.language_preference])

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

  // Fires from ANY API call that comes back 403 PREMIUM_REQUIRED (see
  // api/_lib/subscription.js's assertPremium and setPremiumRequiredHandler
  // in storage.js) — the server-side backstop for the UI's own isPremium
  // checks, so directly hitting a gated endpoint still surfaces the normal
  // upgrade modal instead of a raw error. Rendered in every logged-in
  // branch below, same cross-cutting pattern as <InstallPrompt />.
  useEffect(() => {
    setPremiumRequiredHandler(() => setShowGlobalUpgradeModal(true))
    return () => setPremiumRequiredHandler(null)
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

  // The user was already logged in before the Stripe redirect (their
  // session token survives it — same origin, same localStorage), so unlike
  // finishOAuthCallback/finishVerify there's no "no user" branch to worry
  // about; nextUser is only null when verify-session.js itself failed
  // (see SubscriptionSuccessScreen's error state), in which case there's
  // simply nothing new to apply.
  function finishSubscriptionSuccess(nextUser) {
    window.history.replaceState({}, '', '/')
    setIsSubscriptionSuccessPage(false)
    if (nextUser) setUser(nextUser)
  }

  function finishSubscriptionCancelled() {
    window.history.replaceState({}, '', '/')
    setIsSubscriptionCancelledPage(false)
  }

  if (isAdminPage) {
    return <AdminApp />
  }

  if (isResetPasswordPage) {
    return <ResetPasswordScreen />
  }

  if (isVerifyPage) {
    return <VerifyEmailScreen onVerified={finishVerify} />
  }

  if (isOAuthCallback) {
    return <OAuthCallbackScreen onAuth={finishOAuthCallback} onCancel={() => finishOAuthCallback(null)} />
  }

  if (isSubscriptionSuccessPage) {
    return <SubscriptionSuccessScreen onDone={finishSubscriptionSuccess} />
  }

  if (isSubscriptionCancelledPage) {
    return <SubscriptionCancelledScreen onDone={finishSubscriptionCancelled} />
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
    return (
      <AuthScreen
        initialMode={authMode}
        onAuth={setUser}
        onLogoClick={() => setShowLanding(true)}
        inviteParentCode={inviteParams?.parentCode || null}
        inviteEmail={inviteParams?.email || ''}
        inviteParentUsername={inviteParentUsername}
      />
    )
  }

  if (user.account_type === 'teacher') {
    return (
      <>
        <TeacherFlow user={user} onLogout={handleLogout} onUserUpdate={setUser} />
        <InstallPrompt />
        {showGlobalUpgradeModal && <UpgradeModal user={user} onClose={() => setShowGlobalUpgradeModal(false)} />}
      </>
    )
  }

  if (user.account_type === 'parent') {
    return (
      <>
        <ParentDashboard user={user} onLogout={handleLogout} onUserUpdate={setUser} />
        <InstallPrompt />
        {showGlobalUpgradeModal && <UpgradeModal user={user} onClose={() => setShowGlobalUpgradeModal(false)} />}
      </>
    )
  }

  return (
    <>
      <StudentFlow user={user} onLogout={handleLogout} onUserUpdate={setUser} />
      <InstallPrompt />
      {showGlobalUpgradeModal && <UpgradeModal user={user} onClose={() => setShowGlobalUpgradeModal(false)} />}
    </>
  )
}

export default App
