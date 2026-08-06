import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createCheckoutSession, getStudentsForParent } from '../../lib/storage'
import { getErrorMessage } from '../../lib/errors'

// The one shared "you hit a Premium wall" modal — triggered reactively
// from every gated feature and from tapping the trial countdown banner.
// Now backed by real Stripe Checkout (see api/stripe/create-checkout.js)
// instead of the old mailto: placeholder.
//
// `context` ('default' | 'trial') only changes the intro copy — tapping the
// trial banner gets "upgrade now and never lose access" framing instead of
// the generic feature-locked description.
//
// Plan cascade rules (see api/_lib/stripeSubscription.js for the server
// side of this): a parent buying either plan covers their linked
// student(s), never their own account; a student/teacher buying directly
// covers themselves. So the Family card only appears for a parent, and a
// parent choosing the Student plan with more than one linked child has to
// say which one — that's the studentPicker step below.
//
// Every step always has a working exit (the top-right X, at minimum) — a
// prior version left 'loading' with none at all, so a slow/hung network
// request or a redirect that silently failed to fire left the user
// permanently stuck with no way out except closing the tab.
const SESSION_CREATION_TIMEOUT_MS = 8000
const REDIRECT_STUCK_TIMEOUT_MS = 5000

export default function UpgradeModal({ user, context = 'default', onClose }) {
  const { t } = useTranslation()
  const isParent = user?.account_type === 'parent'

  const [step, setStep] = useState('picker') // 'picker' | 'studentPicker' | 'loading' | 'redirecting' | 'error'
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [students, setStudents] = useState(null)
  const [selectedStudentId, setSelectedStudentId] = useState(null)
  const [error, setError] = useState('')
  const [redirectStuck, setRedirectStuck] = useState(false)

  // Guards against a slow/late createCheckoutSession response (or the 8s
  // timeout firing after it already resolved) applying stale state once the
  // user has already cancelled or hit Retry — only the outcome of the most
  // recent startCheckout call is ever applied.
  const requestIdRef = useRef(0)
  // What Retry re-attempts — the last { plan, studentId } passed to
  // startCheckout, whichever step (timeout or a real error) triggered it.
  const pendingCheckoutRef = useRef(null)

  // Pushes a history entry the moment the modal opens so the browser back
  // button closes it instead of navigating the whole SPA away. No `url`
  // argument is passed, so this doesn't change the current URL — pressing
  // back lands the user back on the same page they were already on, just
  // without the modal. handleDismiss below is the only way this component
  // ever closes itself, and it always goes through history.back() so the
  // resulting popstate event is the single, common path that actually
  // unmounts the modal — whether the close came from the X button or a
  // real back-button press, the two behave identically.
  useEffect(() => {
    window.history.pushState({ zyndalModal: 'upgrade' }, '')
    function handlePopState() {
      finishClose()
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The "taking too long?" reveal only ever applies to the current
  // 'redirecting' attempt — leaving that step (a real navigation away,
  // cancelling, or retrying) always clears it rather than letting a stale
  // timer fire against a step it no longer applies to.
  useEffect(() => {
    if (step !== 'redirecting') {
      setRedirectStuck(false)
      return
    }
    const timer = setTimeout(() => setRedirectStuck(true), REDIRECT_STUCK_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [step])

  function finishClose() {
    try {
      localStorage.setItem('zyndal_premium_modal_dismissed_at', String(Date.now()))
    } catch {
      // Best-effort — a failed write just means no future feature can read
      // this dismissal time back; the modal itself still closes fine.
    }
    onClose()
  }

  function handleDismiss() {
    window.history.back()
  }

  async function startCheckout(plan, studentId) {
    pendingCheckoutRef.current = { plan, studentId }
    const requestId = ++requestIdRef.current
    setError('')
    setStep('loading')

    const timeoutId = setTimeout(() => {
      if (requestIdRef.current !== requestId) return
      setError(t('upgrade.checkoutTimeout'))
      setStep('error')
    }, SESSION_CREATION_TIMEOUT_MS)

    try {
      const { checkout_url: checkoutUrl } = await createCheckoutSession({ plan, studentId })
      if (requestIdRef.current !== requestId) return
      clearTimeout(timeoutId)
      setStep('redirecting')
      window.location.href = checkoutUrl
    } catch (err) {
      if (requestIdRef.current !== requestId) return
      clearTimeout(timeoutId)
      console.error('[UpgradeModal] checkout session creation failed:', err)
      setError(getErrorMessage(err, t, 'upgrade.checkoutError'))
      setStep('error')
    }
  }

  function handleRetry() {
    const pending = pendingCheckoutRef.current
    if (pending) startCheckout(pending.plan, pending.studentId)
  }

  async function handleChoosePlan(plan) {
    if (plan !== 'student' || !isParent) {
      startCheckout(plan)
      return
    }

    setError('')
    let list = students
    if (!list) {
      try {
        list = await getStudentsForParent(user.id)
        setStudents(list)
      } catch (err) {
        console.error('[UpgradeModal] failed to load linked students:', err)
        setError(getErrorMessage(err, t, 'upgrade.checkoutError'))
        return
      }
    }

    if (list.length === 0) {
      setError(t('upgrade.noLinkedStudents'))
    } else if (list.length === 1) {
      startCheckout('student', list[0].id)
    } else {
      setSelectedPlan('student')
      setStep('studentPicker')
    }
  }

  const overlayClickable = step !== 'loading' && step !== 'redirecting'

  return (
    <div className="modal-overlay" onClick={overlayClickable ? handleDismiss : undefined}>
      <div className="modal-card premium-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close-x" onClick={handleDismiss} aria-label={t('home.dismiss')}>
          ✕
        </button>
        <p className="premium-modal-emoji">👑</p>
        <h2 className="modal-title">{t('upgrade.title')}</h2>
        <p className="premium-modal-body">{context === 'trial' ? t('upgrade.trialBody') : t('upgrade.body')}</p>

        {step === 'picker' && (
          <>
            <p className="upgrade-plan-heading">{t('upgrade.choosePlan')}</p>
            <div className="plan-option-list">
              <button type="button" className="plan-option" onClick={() => handleChoosePlan('student')}>
                <span className="plan-option-label">{t('upgrade.planStudentLabel')}</span>
                <span className="plan-option-desc">{t('upgrade.planStudentDesc')}</span>
              </button>
              {isParent && (
                <button type="button" className="plan-option" onClick={() => handleChoosePlan('family')}>
                  <span className="plan-option-label">{t('upgrade.planFamilyLabel')}</span>
                  <span className="plan-option-desc">{t('upgrade.planFamilyDesc')}</span>
                </button>
              )}
            </div>
            {error && <p className="form-error">{error}</p>}
            <button type="button" className="btn btn-ghost btn-block" onClick={handleDismiss}>
              {t('upgrade.maybeLater')}
            </button>
          </>
        )}

        {step === 'studentPicker' && (
          <>
            <p className="upgrade-plan-heading">{t('upgrade.chooseStudent')}</p>
            <div className="plan-option-list">
              {students?.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`plan-option ${selectedStudentId === s.id ? 'plan-option--selected' : ''}`}
                  onClick={() => setSelectedStudentId(s.id)}
                >
                  <span className="plan-option-label">
                    {s.avatar ? `${s.avatar} ` : ''}@{s.username}
                  </span>
                </button>
              ))}
            </div>
            {error && <p className="form-error">{error}</p>}
            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={!selectedStudentId}
              onClick={() => startCheckout(selectedPlan, selectedStudentId)}
            >
              {t('upgrade.continue')}
            </button>
            <button type="button" className="btn btn-ghost btn-block" onClick={() => setStep('picker')}>
              {t('upgrade.maybeLater')}
            </button>
          </>
        )}

        {step === 'loading' && (
          <>
            <p className="premium-modal-body">{t('upgrade.creatingCheckout')}</p>
            <button type="button" className="btn btn-ghost btn-block" onClick={handleDismiss}>
              {t('upgrade.cancel')}
            </button>
          </>
        )}

        {step === 'redirecting' && (
          <>
            <p className="premium-modal-body">{t('upgrade.redirectingToCheckout')}</p>
            {redirectStuck && (
              <>
                <p className="form-error">{t('upgrade.redirectTakingLong')}</p>
                <button type="button" className="btn btn-secondary btn-block" onClick={handleRetry}>
                  {t('upgrade.retry')}
                </button>
              </>
            )}
            <button type="button" className="btn btn-ghost btn-block" onClick={handleDismiss}>
              {redirectStuck ? t('upgrade.clickHereToCancel') : t('upgrade.cancel')}
            </button>
          </>
        )}

        {step === 'error' && (
          <>
            <p className="form-error">{error}</p>
            <button type="button" className="btn btn-primary btn-block" onClick={handleRetry}>
              {t('upgrade.retry')}
            </button>
            <button type="button" className="btn btn-ghost btn-block" onClick={handleDismiss}>
              {t('upgrade.cancel')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
