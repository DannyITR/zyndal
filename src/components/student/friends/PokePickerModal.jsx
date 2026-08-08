import { useTranslation } from 'react-i18next'
import { POKE_PRESETS, pokePresetText } from '../../../lib/pokePresets'

// Opened from a friend row's poke button in FriendsScreen.jsx and
// Leaderboard.jsx (friends tab) — picking a preset sends it immediately and
// closes; there's no free-text option (see api/social/poke.js's own
// comment on why the server only ever accepts one of these ten keys).
export default function PokePickerModal({ friendUsername, onSend, onClose, sending, error }) {
  const { t, i18n } = useTranslation()

  return (
    <div className="modal-overlay" onClick={sending ? undefined : onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{t('friends.pokeModalTitle', { username: friendUsername })}</h3>
        <p className="modal-subtitle">{t('friends.pokeModalSubtitle')}</p>

        {error && <p className="form-error">{error}</p>}

        <div className="poke-preset-list">
          {POKE_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              className="poke-preset-btn"
              disabled={sending}
              onClick={() => onSend(preset.key)}
            >
              {pokePresetText(preset.key, i18n.language)}
            </button>
          ))}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary btn-block" disabled={sending} onClick={onClose}>
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
