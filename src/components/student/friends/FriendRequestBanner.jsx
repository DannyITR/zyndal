import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function FriendRequestBanner({ request, onRespond }) {
  const { t } = useTranslation()
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  async function handle(accept) {
    if (processing) return
    setProcessing(true)
    setError('')
    try {
      await onRespond(request.id, accept)
    } catch {
      setError(t('friends.requestFailed'))
      setProcessing(false)
    }
  }

  return (
    <div className="friend-request-card">
      <p className="friend-request-text">
        <strong>@{request.senderUsername}</strong> {t('friends.wantsToFollow')}
      </p>
      <div className="friend-request-actions">
        <button type="button" className="btn btn-primary btn-small" disabled={processing} onClick={() => handle(true)}>
          {t('common.accept')}
        </button>
        <button type="button" className="btn btn-ghost btn-small" disabled={processing} onClick={() => handle(false)}>
          {t('common.decline')}
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  )
}
