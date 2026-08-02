import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { searchStudentsForParent, sendParentLinkRequest, inviteChildByEmail } from '../../lib/storage'
import { getErrorMessage } from '../../lib/errors'
import TopBar from '../shared/TopBar'

const SHARE_URL_BASE = 'https://zyndal.ca'
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function AddChildScreen({ user, onBack, onLogout, onLogoClick, onChanged }) {
  const { t } = useTranslation()
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
          setSearchError(t('friends.searchFailed'))
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
    // t is a stable function for the app's lifetime (see src/lib/i18n.js) —
    // not a real dependency, and including it would re-search on every
    // language change for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setRequestStatus(getErrorMessage(err, t, 'addChild.requestFailed'))
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
      setEmailError(t('addChild.invalidEmail'))
      return
    }
    setEmailSending(true)
    try {
      await inviteChildByEmail(trimmed)
      setEmailSent(trimmed)
      setChildEmail('')
      onChanged?.()
    } catch (err) {
      setEmailError(getErrorMessage(err, t, 'addChild.sendInviteFailed'))
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
      <TopBar title={t('parent.addChild')} subtitle={t('addChild.subtitle')} username={user.username} onBack={onBack} onLogout={onLogout} onLogoClick={onLogoClick} />

      <div className="auth-tabs">
        <button type="button" className={`auth-tab ${tab === 'search' ? 'auth-tab--active' : ''}`} onClick={() => setTab('search')}>
          {t('addChild.tabSearch')}
        </button>
        <button type="button" className={`auth-tab ${tab === 'email' ? 'auth-tab--active' : ''}`} onClick={() => setTab('email')}>
          {t('addChild.tabEmail')}
        </button>
        <button type="button" className={`auth-tab ${tab === 'code' ? 'auth-tab--active' : ''}`} onClick={() => setTab('code')}>
          {t('addChild.tabCode')}
        </button>
      </div>

      {tab === 'search' && (
        <div className="finance-section-card">
          <h3 className="section-heading">{t('addChild.searchHeading')}</h3>
          <div className="friend-search-input-wrap" ref={searchContainerRef}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => {
                if (dropdownResults !== null) setDropdownOpen(true)
              }}
              placeholder={t('addChild.searchPlaceholder')}
            />

            {dropdownOpen && (
              <div className="friend-search-dropdown">
                {searching ? (
                  <p className="friend-search-dropdown-empty">{t('friends.searching')}</p>
                ) : dropdownResults && dropdownResults.length === 0 ? (
                  <p className="friend-search-dropdown-empty">{t('addChild.noStudentsFound')}</p>
                ) : (
                  dropdownResults?.map((result) => (
                    <button key={result.id} type="button" className="friend-search-dropdown-item" onClick={() => handleSelectResult(result)}>
                      <span className="friend-search-dropdown-avatar">{result.avatar || '👤'}</span>
                      <span className="friend-search-dropdown-info">
                        <span className="friend-search-dropdown-username">@{result.username}</span>
                        {result.grade && <span className="friend-search-dropdown-grade">{t('common.gradeLabel', { grade: result.grade })}</span>}
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
                <span className="friend-search-status">{t('friends.requested')}</span>
              ) : (
                <button type="button" className="btn btn-primary btn-small" disabled={requestStatus === 'sending'} onClick={handleSendRequest}>
                  {requestStatus === 'sending' ? t('common.sending') : t('addChild.sendLinkRequest')}
                </button>
              )}
              {requestStatus && requestStatus !== 'sending' && requestStatus !== 'sent' && <p className="friend-search-error">{requestStatus}</p>}
            </div>
          )}
        </div>
      )}

      {tab === 'email' && (
        <div className="finance-section-card">
          <h3 className="section-heading">{t('addChild.tabEmail')}</h3>
          <p className="field-hint">{t('addChild.emailHint')}</p>
          <form className="auth-form" onSubmit={handleSendEmailInvite}>
            <div className="field">
              <label htmlFor="child-email">{t('addChild.emailLabel')}</label>
              <input
                id="child-email"
                type="email"
                value={childEmail}
                onChange={(e) => setChildEmail(e.target.value)}
                placeholder="child@example.com"
              />
            </div>
            {emailError && <p className="form-error">{emailError}</p>}
            {emailSent && <p className="form-success">{t('addChild.invitationSent', { email: emailSent })}</p>}
            <button type="submit" className="btn btn-primary btn-block" disabled={emailSending}>
              {emailSending ? t('common.sending') : t('addChild.sendInvite')}
            </button>
          </form>
        </div>
      )}

      {tab === 'code' && (
        <div className="parent-code-card">
          <p className="parent-code-label">{t('addChild.yourParentCode')}</p>
          <div className="parent-code-value-row">
            <span className="parent-code-value">{user.parent_code}</span>
            <button type="button" className="btn btn-secondary btn-small" onClick={handleCopyCode}>
              {copied ? t('addChild.copied') : t('addChild.copyCode')}
            </button>
          </div>
          <p className="field-hint">{t('addChild.shareCodeHint')}</p>
          <button type="button" className="btn btn-secondary btn-block" onClick={handleShareLink}>
            {shareStatus === 'copied' ? t('addChild.linkCopied') : t('addChild.shareInviteLink')}
          </button>
        </div>
      )}
    </div>
  )
}
