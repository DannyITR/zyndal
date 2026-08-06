import { useState } from 'react'
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
export default function UpgradeModal({ user, context = 'default', onClose }) {
  const { t } = useTranslation()
  const isParent = user?.account_type === 'parent'

  const [step, setStep] = useState('picker') // 'picker' | 'studentPicker' | 'loading'
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [students, setStudents] = useState(null)
  const [selectedStudentId, setSelectedStudentId] = useState(null)
  const [error, setError] = useState('')

  function handleDismiss() {
    try {
      localStorage.setItem('zyndal_premium_modal_dismissed_at', String(Date.now()))
    } catch {
      // Best-effort — a failed write just means no future feature can read
      // this dismissal time back; the modal itself still closes fine.
    }
    onClose()
  }

  async function startCheckout(plan, studentId) {
    setError('')
    setStep('loading')
    try {
      const { checkout_url: checkoutUrl } = await createCheckoutSession({ plan, studentId })
      window.location.href = checkoutUrl
    } catch (err) {
      console.error('[UpgradeModal] checkout session creation failed:', err)
      setError(getErrorMessage(err, t, 'upgrade.checkoutError'))
      setStep(plan === 'student' && isParent && students?.length > 1 ? 'studentPicker' : 'picker')
    }
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

  return (
    <div className="modal-overlay" onClick={step === 'loading' ? undefined : handleDismiss}>
      <div className="modal-card premium-modal" onClick={(e) => e.stopPropagation()}>
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

        {step === 'loading' && <p className="premium-modal-body">{t('upgrade.creatingCheckout')}</p>}
      </div>
    </div>
  )
}
