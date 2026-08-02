import { useEffect, useRef, useState } from 'react'
import { searchStudentsForParent, sendParentLinkRequest, inviteChildByEmail } from '../../lib/storage'
import TopBar from '../shared/TopBar'

const SHARE_URL_BASE = 'https://zyndal.ca'
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function AddChildScreen({ user, onBack, onLogout, onLogoClick, onChanged }) {
  const [tab, setTab] = useState('search') // search | email | code

  // ---------- Tab 1: search by username (mirrors FriendsScreen.jsx) ----------
  const [query, setQuery] = useState('')
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [dropdownResults, setDropdownResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [requestStatus, setRequestStatus] = useState('') // '' | 'sending' | 'sent' | error message
  const searchContainerRef = useRef(null)
  const skipNextSearchRef = useRef(false)

  useEffect(() => {
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false
      return
    }
    setSelectedStudent(null)
    setRequestStatus('')
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setDropdownResults(null)
      setDropdownOpen(false)
      setSearching(false)
      setSearchError('')
      return
    }
    setSearchError('')
    let cancelled = false
    const timer = setTimeout(() => {
      if (cancelled) return
      setSearching(true)
      setDropdownOpen(true)
      searchStudentsForParent(trimmed)
        .then((list) => {
          if (cancelled) return
          setDropdownResults(list)
        })
        .catch(() => {
          if (cancelled) return
          setSearchError("Couldn't search right now. Please try again.")
          setDropdownOpen(false)
          setDropdownResults(null)
        })
        .finally(() => {
          if (!cancelled) setSearching(false)
        })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  useEffect(() => {
    function handleClickOutside(e) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSelectResult(result) {
    skipNextSearchRef.current = true
    setQuery(result.username)
    setSelectedStudent(result)
    setDropdownOpen(false)
  }

  async function handleSendRequest() {
    if (!selectedStudent || requestStatus === 'sending' || requestStatus === 'sent') return
    setRequestStatus('sending')
    try {
      await sendParentLinkRequest(selectedStudent.id)
      setRequestStatus('sent')
      onChanged?.()
    } catch (err) {
      setRequestStatus(err.message || 'Failed')
    }
  }

  // ---------- Tab 2: invite by email ----------
  const [childEmail, setChildEmail] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [emailSent, setEmailSent] = useState('')

  async function handleSendEmailInvite(e) {
    e.preventDefault()
    setEmailError('')
    setEmailSent('')
    const trimmed = childEmail.trim()
    if (!EMAIL_PATTERN.test(trimmed)) {
      setEmailError('Please enter a valid email address.')
      return
    }
    setEmailSending(true)
    try {
      await inviteChildByEmail(trimmed)
      setEmailSent(trimmed)
      setChildEmail('')
      onChanged?.()
    } catch (err) {
      setEmailError(err.message || "Couldn't send the invitation. Please try again.")
    } finally {
      setEmailSending(false)
    }
  }

  // ---------- Tab 3: share code ----------
  const [copied, setCopied] = useState(false)
  const [shareStatus, setShareStatus] = useState('') // '' | 'copied'

  function handleCopyCode() {
    navigator.clipboard?.writeText(user.parent_code).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      },
      () => {}
    )
  }

  async function handleShareLink() {
    const url = `${SHARE_URL_BASE}?parent_code=${encodeURIComponent(user.parent_code)}`
    const shareData = { title: 'Zyndal', text: 'Join me on Zyndal as my linked student!', url }
    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData)
      } catch {
        // Cancelled — nothing to recover from.
      }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setShareStatus('copied')
      setTimeout(() => setShareStatus(''), 2000)
    } catch {
      setShareStatus('')
    }
  }

  return (
    <div className="screen">
      <TopBar title="➕ Add Child" subtitle="Link your child's account" username={user.username} onBack={onBack} onLogout={onLogout} onLogoClick={onLogoClick} />

      <div className="auth-tabs">
        <button type="button" className={`auth-tab ${tab === 'search' ? 'auth-tab--active' : ''}`} onClick={() => setTab('search')}>
          Search Username
        </button>
        <button type="button" className={`auth-tab ${tab === 'email' ? 'auth-tab--active' : ''}`} onClick={() => setTab('email')}>
          Invite by Email
        </button>
        <button type="button" className={`auth-tab ${tab === 'code' ? 'auth-tab--active' : ''}`} onClick={() => setTab('code')}>
          Share Code
        </button>
      </div>

      {tab === 'search' && (
        <div className="finance-section-card">
          <h3 className="section-heading">Search for your child's Zyndal username</h3>
          <div className="friend-search-input-wrap" ref={searchContainerRef}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => {
                if (dropdownResults !== null) setDropdownOpen(true)
              }}
              placeholder="Search by username..."
            />

            {dropdownOpen && (
              <div className="friend-search-dropdown">
                {searching ? (
                  <p className="friend-search-dropdown-empty">Searching…</p>
                ) : dropdownResults && dropdownResults.length === 0 ? (
                  <p className="friend-search-dropdown-empty">No students found with that username</p>
                ) : (
                  dropdownResults?.map((result) => (
                    <button key={result.id} type="button" className="friend-search-dropdown-item" onClick={() => handleSelectResult(result)}>
                      <span className="friend-search-dropdown-avatar">{result.avatar || '👤'}</span>
                      <span className="friend-search-dropdown-info">
                        <span className="friend-search-dropdown-username">@{result.username}</span>
                        {result.grade && <span className="friend-search-dropdown-grade">Grade {result.grade}</span>}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          {searchError && <p className="form-error">{searchError}</p>}

          {selectedStudent && (
            <div className="friend-search-row">
              <span className="friend-search-name">@{selectedStudent.username}</span>
              {requestStatus === 'sent' ? (
                <span className="friend-search-status">Requested ✓</span>
              ) : (
                <button type="button" className="btn btn-primary btn-small" disabled={requestStatus === 'sending'} onClick={handleSendRequest}>
                  {requestStatus === 'sending' ? 'Sending…' : 'Send Link Request'}
                </button>
              )}
              {requestStatus && requestStatus !== 'sending' && requestStatus !== 'sent' && <p className="friend-search-error">{requestStatus}</p>}
            </div>
          )}
        </div>
      )}

      {tab === 'email' && (
        <div className="finance-section-card">
          <h3 className="section-heading">Invite by Email</h3>
          <p className="field-hint">We'll send your child an email with a link to create their account, already linked to you.</p>
          <form className="auth-form" onSubmit={handleSendEmailInvite}>
            <div className="field">
              <label htmlFor="child-email">Child's email address</label>
              <input
                id="child-email"
                type="email"
                value={childEmail}
                onChange={(e) => setChildEmail(e.target.value)}
                placeholder="child@example.com"
              />
            </div>
            {emailError && <p className="form-error">{emailError}</p>}
            {emailSent && <p className="form-success">Invitation sent to {emailSent}!</p>}
            <button type="submit" className="btn btn-primary btn-block" disabled={emailSending}>
              {emailSending ? 'Sending…' : 'Send Invite'}
            </button>
          </form>
        </div>
      )}

      {tab === 'code' && (
        <div className="parent-code-card">
          <p className="parent-code-label">Your parent code</p>
          <div className="parent-code-value-row">
            <span className="parent-code-value">{user.parent_code}</span>
            <button type="button" className="btn btn-secondary btn-small" onClick={handleCopyCode}>
              {copied ? 'Copied!' : 'Copy code'}
            </button>
          </div>
          <p className="field-hint">Share this with your child so they can link their account.</p>
          <button type="button" className="btn btn-secondary btn-block" onClick={handleShareLink}>
            {shareStatus === 'copied' ? 'Link copied!' : '📣 Share invite link'}
          </button>
        </div>
      )}
    </div>
  )
}
