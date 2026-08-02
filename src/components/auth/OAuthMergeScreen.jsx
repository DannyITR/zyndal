import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { oauthMerge } from '../../lib/storage'
import { getErrorMessage } from '../../lib/errors'
import Logo from '../shared/Logo'

const PROVIDER_LABELS = { google: 'Google', facebook: 'Facebook' }

// Shown when api/auth/oauth-callback.js responds with needs_merge: true —
// the OAuth email matches an existing username/password account, and
// linking them requires proving the person actually owns that account
// (see api/auth/oauth-merge.js). mergeInfo comes straight from
// OAuthCallbackScreen's oauthCallback() call: { existing_username,
// provider_email, provider, supabaseAccessToken }.
export default function OAuthMergeScreen({ mergeInfo, onLinked, onCancel }) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const providerLabel = PROVIDER_LABELS[mergeInfo.provider] || mergeInfo.provider

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const user = await oauthMerge({
        provider: mergeInfo.provider,
        supabaseAccessToken: mergeInfo.supabaseAccessToken,
        existingUsername: mergeInfo.existing_username,
        existingPassword: password,
      })
      onLinked(user)
    } catch (err) {
      setError(getErrorMessage(err, t))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <Logo size="large" />
        <h2 className="oauth-onboarding-title">Link your accounts</h2>
        <p className="auth-tagline">
          An account already exists with this email (@{mergeInfo.existing_username}). Enter your Zyndal password to link your{' '}
          {providerLabel} account.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="merge-password">Zyndal password</label>
            <input
              id="merge-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
            />
          </div>

          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting || !password}>
            {submitting ? 'Linking…' : 'Link Accounts'}
          </button>
        </form>

        <button type="button" className="oauth-use-different-email" onClick={onCancel}>
          Use a different email
        </button>
      </div>
    </div>
  )
}
