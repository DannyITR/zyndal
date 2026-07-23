import { useEffect, useState } from 'react'

const DISMISS_KEY = 'zyndal_install_prompt_seen'

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

// Shown at most once per device — iOS has no programmatic install API, so it
// gets static instructions; Android/Chrome defers the native
// beforeinstallprompt event and fires it from the "Install" button tap.
export default function InstallPrompt() {
  const [visible, setVisible] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [platform, setPlatform] = useState('android')

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISS_KEY)) return

    if (isIOS()) {
      setPlatform('ios')
      setVisible(true)
      localStorage.setItem(DISMISS_KEY, '1')
      return
    }

    function handleBeforeInstallPrompt(e) {
      e.preventDefault()
      setDeferredPrompt(e)
      setPlatform('android')
      setVisible(true)
      localStorage.setItem(DISMISS_KEY, '1')
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  }, [])

  function dismiss() {
    setVisible(false)
  }

  async function handleInstall() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="install-prompt">
      <span className="install-prompt-icon">⚡</span>
      <div className="install-prompt-text">
        <p className="install-prompt-title">Add Zyndal to your Home Screen</p>
        <p className="install-prompt-detail">
          {platform === 'ios'
            ? "Tap the share icon, then 'Add to Home Screen'"
            : 'Install the app for quick, full-screen access.'}
        </p>
      </div>
      <div className="install-prompt-actions">
        {platform === 'android' && (
          <button type="button" className="btn btn-primary btn-small" onClick={handleInstall}>
            Install
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-small" onClick={dismiss}>
          Not now
        </button>
      </div>
    </div>
  )
}
