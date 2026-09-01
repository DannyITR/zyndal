import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { submitClassClaim } from '../../lib/storage'
import { getErrorMessage } from '../../lib/errors'

// Temporarily off for testing, so a claim can be submitted with any email —
// mirrors EMAIL_DOMAIN_CHECK_ENABLED (api/teacher/submit-class-claim.js).
// Flip both back to true together to restore the real domain-match gate.
const EMAIL_DOMAIN_CHECK_ENABLED = false

// The teacher's account email isn't a form field — it's already on their
// account and just needs to be shown + checked against the target school's
// domain (the actual match is re-verified server-side in
// submit-class-claim.js; this is only a heads-up so a mismatch is caught
// before they fill in the rest of the form).
export default function ClaimClassModal({ user, group, schoolDomain, onSubmitted, onClose }) {
  const { t } = useTranslation()
  const [courseNumber, setCourseNumber] = useState('')
  const [bioLink, setBioLink] = useState('')
  const [displayName, setDisplayName] = useState(user.display_name || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const email = (user.email || '').toLowerCase()
  const emailMatches = !EMAIL_DOMAIN_CHECK_ENABLED || (Boolean(schoolDomain) && email.endsWith(`@${schoolDomain.toLowerCase()}`))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!emailMatches) {
      setError(t('teacher.claimEmailMismatch', { domain: schoolDomain }))
      return
    }
    setSaving(true)
    try {
      await submitClassClaim({
        groupId: group.id,
        bioLink: bioLink.trim(),
        courseNumber: courseNumber.trim(),
        displayName: displayName.trim(),
      })
      onSubmitted()
    } catch (err) {
      setError(getErrorMessage(err, t, 'teacher.claimSubmitFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">{t('teacher.claimClassTitle')}</h2>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="field">
            <label>{t('teacher.claimYourEmail')}</label>
            <p className={`field-hint ${emailMatches ? '' : 'form-error'}`}>
              {user.email ? user.email : t('teacher.claimNoEmail')}
              {' — '}
              {emailMatches ? t('teacher.claimEmailOk') : t('teacher.claimEmailMismatch', { domain: schoolDomain })}
            </p>
          </div>
          <div className="field">
            <label htmlFor="claim-course-number">{t('teacher.claimCourseNumber')}</label>
            <input
              id="claim-course-number"
              value={courseNumber}
              onChange={(e) => setCourseNumber(e.target.value)}
              placeholder="e.g. Math 416"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="claim-bio-link">{t('teacher.claimBioLink')}</label>
            <input
              id="claim-bio-link"
              type="url"
              value={bioLink}
              onChange={(e) => setBioLink(e.target.value)}
              placeholder="https://yourschool.example/staff/you"
              required
            />
            <p className="field-hint">{t('teacher.claimBioLinkHint')}</p>
          </div>
          <div className="field">
            <label htmlFor="claim-display-name">{t('teacher.claimDisplayName')}</label>
            <input
              id="claim-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Mr. Smith"
              required
            />
            <p className="field-hint">{t('teacher.claimDisplayNameHint')}</p>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? t('teacher.claimSubmitting') : t('teacher.claimSubmit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
