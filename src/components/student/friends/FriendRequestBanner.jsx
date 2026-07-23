import { useState } from 'react'

export default function FriendRequestBanner({ request, onRespond }) {
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  async function handle(accept) {
    if (processing) return
    setProcessing(true)
    setError('')
    try {
      await onRespond(request.id, accept)
    } catch {
      setError("Couldn't update this request. Please try again.")
      setProcessing(false)
    }
  }

  return (
    <div className="friend-request-card">
      <p className="friend-request-text">
        <strong>@{request.senderUsername}</strong> wants to follow you
      </p>
      <div className="friend-request-actions">
        <button type="button" className="btn btn-primary btn-small" disabled={processing} onClick={() => handle(true)}>
          Accept
        </button>
        <button type="button" className="btn btn-ghost btn-small" disabled={processing} onClick={() => handle(false)}>
          Decline
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  )
}
