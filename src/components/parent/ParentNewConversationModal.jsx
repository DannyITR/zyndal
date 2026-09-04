import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getMessageableContacts } from '../../lib/storage'
import { getErrorMessage } from '../../lib/errors'

// A parent's "start a new conversation" picker — only ever offers their own
// linked child(ren) or that child's own teacher(s), matching exactly what
// api/_lib/messaging.js's verifyConversationAllowed permits for a
// parent+student or parent+teacher pairing. onSelect(otherUserId) is called
// with whichever contact was tapped; ParentDashboard.jsx then opens
// MessagesFlow.jsx pointed at that id via initialOtherUserId.
export default function ParentNewConversationModal({ onSelect, onClose }) {
  const { t } = useTranslation()
  const [children, setChildren] = useState(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    getMessageableContacts()
      .then((data) => setChildren(data.children))
      .catch((err) => setLoadError(getErrorMessage(err, t, 'messages.loadFailed')))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">{t('parent.newConversation')}</h2>
        <p className="field-hint">{t('parent.newConversationSubtitle')}</p>

        {loadError && <p className="form-error">{loadError}</p>}

        {!children && !loadError && <p className="loading-text">{t('common.loading')}</p>}

        {children && children.length === 0 && <p className="field-hint">{t('parent.newConversationNoContacts')}</p>}

        {children && children.length > 0 && (
          <div className="teacher-student-list">
            {children.map((child) => (
              <div key={child.id}>
                <p className="section-heading">{t('parent.newConversationChildLabel')}</p>
                <button type="button" className="conversation-row" onClick={() => onSelect(child.id)}>
                  <span className="conversation-row-avatar">{child.avatar || '👤'}</span>
                  <div className="conversation-row-info">
                    <p className="conversation-row-name">@{child.username}</p>
                  </div>
                </button>

                <p className="section-heading">{t('parent.newConversationTeachersLabel', { name: child.username })}</p>
                {child.teachers.length === 0 ? (
                  <p className="field-hint">{t('parent.newConversationNoTeachers')}</p>
                ) : (
                  child.teachers.map((teacher) => (
                    <button key={teacher.id} type="button" className="conversation-row" onClick={() => onSelect(teacher.id)}>
                      <span className="conversation-row-avatar">{teacher.avatar || '👤'}</span>
                      <div className="conversation-row-info">
                        <p className="conversation-row-name">@{teacher.username}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            ))}
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
