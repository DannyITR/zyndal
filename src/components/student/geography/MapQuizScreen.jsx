import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import TopBar from '../../shared/TopBar'
import {
  CANADA_MAP_SVG_URL,
  MAP_QUIZ_VIEWBOX,
  MAP_QUIZ_REGIONS,
  MAP_QUIZ_TOTAL,
  PROVINCE_SVG_IDS,
  OCEAN_RECTS,
  BASE_WATER_RECT,
  shuffledRegionIds,
} from '../../../lib/mapQuizRegions'

const SVG_NS = 'http://www.w3.org/2000/svg'

// Grade 10 Geography practice activity — label every province, territory,
// and surrounding ocean on a real map of Canada (see mapQuizRegions.js for
// where the base map comes from and how the three oceans are laid over
// it). Deliberately outside the XP/coins/streak system entirely: no
// storage.js call ever runs here, so there's nothing to award or persist —
// every replay just resets this component's own local state, matching the
// "practice-only, unlimited retries, no daily limit" spec exactly.
export default function MapQuizScreen({ user, onBack, onLogout, onLogoClick }) {
  const { t } = useTranslation()
  const mapHostRef = useRef(null)
  // regionId -> the actual DOM element (a province <g> from the fetched
  // map, or an ocean <rect> built here) — filled once by the load effect
  // below, then read (never causing a re-render) by the visual-sync effect
  // every time the game state changes.
  const regionElsRef = useRef({})
  const [mapStatus, setMapStatus] = useState('loading') // 'loading' | 'ready' | 'error'
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

  // The map's click/keydown listeners are attached once, imperatively,
  // when the SVG loads (below) — they're plain addEventListener calls, not
  // JSX props, so they can't pick up a fresh handleRegionClick closure on
  // every render the way a normal onClick would. Routing them through a
  // ref that's reassigned on every render keeps them calling the current
  // closure (current assignedIds) without needing to re-wire listeners.
  const handleRegionClickRef = useRef(handleRegionClick)
  handleRegionClickRef.current = handleRegionClick

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

  // Fetch the real Canada map once and build the quiz's clickable layer on
  // top of it: a base "water" rect (so lakes/bays the source map masks out
  // read as water instead of the page background), the three ocean rects,
  // then the fetched province/territory groups themselves.
  useEffect(() => {
    let cancelled = false
    fetch(CANADA_MAP_SVG_URL, { cache: 'force-cache' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.text()
      })
      .then((svgText) => {
        if (cancelled || !mapHostRef.current) return
        mapHostRef.current.innerHTML = svgText
        const svg = mapHostRef.current.querySelector('svg')
        if (!svg) throw new Error('no <svg> root in fetched map')

        svg.removeAttribute('width')
        svg.removeAttribute('height')
        svg.setAttribute('viewBox', MAP_QUIZ_VIEWBOX)
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
        svg.classList.add('map-quiz-svg')
        // The source file's own <style> is a bare, page-wide `path{...}`
        // rule (no scoping) — left in place it'd leak stroke-linejoin/
        // linecap onto every other <path> in the app. The same rule is
        // applied scoped instead, see ".map-quiz-svg path" in App.css.
        svg.querySelector('style')?.remove()

        const elements = {}

        const baseWater = document.createElementNS(SVG_NS, 'rect')
        baseWater.setAttribute('class', 'map-quiz-base-water')
        baseWater.setAttribute('x', BASE_WATER_RECT.x)
        baseWater.setAttribute('y', BASE_WATER_RECT.y)
        baseWater.setAttribute('width', BASE_WATER_RECT.width)
        baseWater.setAttribute('height', BASE_WATER_RECT.height)
        svg.insertBefore(baseWater, svg.firstChild)

        // Oceans render before the real land groups so a province always
        // draws on top of them in any overlap — an ocean region ends up
        // "there" (visible and clickable) only where no province covers it.
        let insertAfter = baseWater
        for (const [regionId, rect] of Object.entries(OCEAN_RECTS)) {
          const el = document.createElementNS(SVG_NS, 'rect')
          el.id = `map-quiz-region-${regionId}`
          el.setAttribute('x', rect.x)
          el.setAttribute('y', rect.y)
          el.setAttribute('width', rect.width)
          el.setAttribute('height', rect.height)
          svg.insertBefore(el, insertAfter.nextSibling)
          insertAfter = el
          elements[regionId] = el
        }

        for (const [regionId, svgId] of Object.entries(PROVINCE_SVG_IDS)) {
          const g = svg.querySelector(`g#${svgId}`)
          if (!g) continue
          g.id = `map-quiz-region-${regionId}`
          // The source map colours provinces via a `fill` attribute on
          // the group (inherited by its child path/use) — remove it so
          // the CSS classes below (which set fill per game state) win.
          g.removeAttribute('fill')
          g.querySelectorAll('path, use').forEach((el) => el.style.removeProperty('fill'))
          elements[regionId] = g
        }

        for (const region of MAP_QUIZ_REGIONS) {
          const el = elements[region.id]
          if (!el) continue
          el.classList.add('map-quiz-region', `map-quiz-region--${region.kind}`)
          el.setAttribute('tabindex', '0')
          el.setAttribute('role', 'button')
          el.insertBefore(document.createElementNS(SVG_NS, 'title'), el.firstChild)
          el.addEventListener('click', () => handleRegionClickRef.current(region.id))
          el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleRegionClickRef.current(region.id)
            }
          })
        }

        regionElsRef.current = elements
        setMapStatus('ready')
      })
      .catch((err) => {
        console.error('[MapQuiz] failed to load the map:', err)
        if (!cancelled) setMapStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Keeps the map's visual state — label, correct/active styling, the ✓
  // mark — in sync with the game state. Separate from the load effect
  // above since this needs to re-run on every guess, not just once.
  useEffect(() => {
    const elements = regionElsRef.current
    for (const region of MAP_QUIZ_REGIONS) {
      const el = elements[region.id]
      if (!el) continue
      const isCorrect = assignedIds.has(region.id)
      const label = isCorrect
        ? t(`mapQuiz.regions.${region.id}`)
        : t('mapQuiz.unlabeledRegion', { kind: t(`mapQuiz.kind.${region.kind}`) })

      el.setAttribute('aria-label', label)
      el.setAttribute('tabindex', isCorrect ? '-1' : '0')
      const titleEl = el.querySelector(':scope > title')
      if (titleEl) titleEl.textContent = label
      el.classList.toggle('map-quiz-region--correct', isCorrect)
      el.classList.toggle('map-quiz-region--active', openRegionId === region.id)

      let mark = el.querySelector(':scope > .map-quiz-region-check')
      if (isCorrect && !mark) {
        const bbox = el.getBBox()
        mark = document.createElementNS(SVG_NS, 'text')
        mark.setAttribute('class', 'map-quiz-region-check')
        mark.setAttribute('x', bbox.x + bbox.width / 2)
        mark.setAttribute('y', bbox.y + bbox.height / 2)
        mark.textContent = '✓'
        el.appendChild(mark)
      } else if (!isCorrect && mark) {
        mark.remove()
      }
    }
  }, [assignedIds, openRegionId, t])

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
        {mapStatus === 'loading' && <p className="field-hint">{t('common.loading')}</p>}
        {mapStatus === 'error' && <p className="form-error">{t('mapQuiz.loadError')}</p>}
        <div ref={mapHostRef} className="map-quiz-svg-host" role="group" aria-label={t('mapQuiz.title')} hidden={mapStatus !== 'ready'} />
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
