import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import TopBar from '../../shared/TopBar'
import { MAP_QUIZ_REGIONS, MAP_QUIZ_VIEWBOX, MAP_QUIZ_TOTAL, shuffledRegionIds } from '../../../lib/mapQuizRegions'

// Grade 10 Geography practice activity — label every province, territory,
// and surrounding ocean on a schematic map of Canada (see mapQuizRegions.js
// for why the shapes are plain rectangles, not traced coastlines).
// Deliberately outside the XP/coins/streak system entirely: no storage.js
// call ever runs here, so there's nothing to award or persist — every
// replay just resets this component's own local state, matching the
// "practice-only, unlimited retries, no daily limit" spec exactly.
export default function MapQuizScreen({ user, onBack, onLogout, onLogoClick }) {
  const { t } = useTranslation()
  const [assignedIds, setAssignedIds] = useState(() => new Set())
  const [attemptedWrongIds, setAttemptedWrongIds] = useState(() => new Set())
  const [openRegionId, setOpenRegionId] = useState(null)
  const [popupNames, setPopupNames] = useState([])
  const [wrongFlashId, setWrongFlashId] = useState(null)

  const completed = assignedIds.size === MAP_QUIZ_TOTAL

  function handleRegionClick(regionId) {
    if (assignedIds.has(regionId)) return
    const remaining = MAP_QUIZ_REGIONS.map((r) => r.id).filter((id) => !assignedIds.has(id))
    setOpenRegionId(regionId)
    setPopupNames(shuffledRegionIds(remaining))
    setWrongFlashId(null)
  }

  function handleGuess(nameId) {
    if (nameId === openRegionId) {
      setAssignedIds((prev) => new Set(prev).add(openRegionId))
      setOpenRegionId(null)
      setPopupNames([])
      setWrongFlashId(null)
      return
    }
    setAttemptedWrongIds((prev) => new Set(prev).add(openRegionId))
    setWrongFlashId(nameId)
    setTimeout(() => setWrongFlashId((cur) => (cur === nameId ? null : cur)), 400)
  }

  function handlePlayAgain() {
    setAssignedIds(new Set())
    setAttemptedWrongIds(new Set())
    setOpenRegionId(null)
    setPopupNames([])
    setWrongFlashId(null)
  }

  const openRegion = MAP_QUIZ_REGIONS.find((r) => r.id === openRegionId) || null
  const correctCount = MAP_QUIZ_TOTAL - attemptedWrongIds.size

  return (
    <div className="screen student-screen">
      <TopBar
        title={t('mapQuiz.title')}
        subtitle={t('mapQuiz.subtitle')}
        username={user.username}
        onBack={onBack}
        onLogout={onLogout}
        onLogoClick={onLogoClick}
      />

      <div className="map-quiz-progress-row">
        <span className="map-quiz-progress-pill">{t('mapQuiz.progress', { labeled: assignedIds.size, total: MAP_QUIZ_TOTAL })}</span>
        <button type="button" className="btn btn-ghost btn-small" onClick={handlePlayAgain}>
          {t('mapQuiz.reset')}
        </button>
      </div>

      <p className="field-hint">{t('mapQuiz.practiceNote')}</p>

      <div className="map-quiz-map-wrap">
        <svg className="map-quiz-svg" viewBox={MAP_QUIZ_VIEWBOX} role="group" aria-label={t('mapQuiz.title')}>
          {MAP_QUIZ_REGIONS.map((region) => {
            const isCorrect = assignedIds.has(region.id)
            const label = isCorrect
              ? t(`mapQuiz.regions.${region.id}`)
              : t('mapQuiz.unlabeledRegion', { kind: t(`mapQuiz.kind.${region.kind}`) })
            const classes = [
              'map-quiz-region',
              `map-quiz-region--${region.kind}`,
              isCorrect ? 'map-quiz-region--correct' : '',
              openRegionId === region.id ? 'map-quiz-region--active' : '',
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <g
                key={region.id}
                role="button"
                tabIndex={isCorrect ? -1 : 0}
                aria-label={label}
                onClick={() => handleRegionClick(region.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleRegionClick(region.id)
                  }
                }}
              >
                <title>{label}</title>
                <rect
                  x={region.x + 3}
                  y={region.y + 3}
                  width={region.width - 6}
                  height={region.height - 6}
                  rx={10}
                  className={classes}
                />
                {isCorrect && (
                  <text x={region.x + region.width / 2} y={region.y + region.height / 2} className="map-quiz-region-check">
                    ✓
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {openRegion && (
        <div className="modal-overlay" onClick={() => setOpenRegionId(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">{t('mapQuiz.popupTitle')}</h2>
            <p className="modal-subtitle">{t('mapQuiz.popupSubtitle')}</p>

            <div className="map-quiz-name-grid">
              {popupNames.map((nameId) => (
                <button
                  key={nameId}
                  type="button"
                  className={`btn btn-secondary map-quiz-name-btn${wrongFlashId === nameId ? ' map-quiz-name-btn--wrong' : ''}`}
                  onClick={() => handleGuess(nameId)}
                >
                  {t(`mapQuiz.regions.${nameId}`)}
                </button>
              ))}
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost btn-block" onClick={() => setOpenRegionId(null)}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {completed && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h2 className="modal-title">{t('mapQuiz.summaryTitle')}</h2>
            <p className="modal-subtitle">{t('mapQuiz.summaryScore', { correct: correctCount, total: MAP_QUIZ_TOTAL })}</p>

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost btn-block" onClick={onBack}>
                {t('common.done')}
              </button>
              <button type="button" className="btn btn-primary btn-block" onClick={handlePlayAgain}>
                {t('mapQuiz.playAgain')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
