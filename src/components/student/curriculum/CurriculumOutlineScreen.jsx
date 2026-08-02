import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getOrGenerateCurriculumOutline } from '../../../lib/storage'
import { gradeToSecondary } from '../../../lib/questions'
import { getErrorMessage } from '../../../lib/errors'
import { LOCALE_FOR_LANGUAGE } from '../../../lib/i18n'
import TopBar from '../../shared/TopBar'

// The outline is a static reference document generated at most once per
// subject+grade combination (see saveCurriculumOutline) and shared globally
// from Supabase, so it's safe to also cache it in localStorage per device —
// once loaded, the page keeps working offline without ever going stale in a
// way that matters (the underlying content only changes if someone
// manually clears the Supabase row and forces a regeneration).
function cacheKey(subjectId, grade) {
  return `zyndal_curriculum_${subjectId}_${grade}`
}

function readCache(subjectId, grade) {
  try {
    const raw = localStorage.getItem(cacheKey(subjectId, grade))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeCache(subjectId, grade, payload) {
  try {
    localStorage.setItem(cacheKey(subjectId, grade), JSON.stringify(payload))
  } catch {
    // Best-effort — offline fallback just won't be available on this device.
  }
}

export default function CurriculumOutlineScreen({ user, subject, initialUnitNumber, initialTopicTitle, onBack, onLogout, onLogoClick }) {
  const { t, i18n } = useTranslation()
  const grade = user.grade || 9
  const [outline, setOutline] = useState(null)
  const [generatedAt, setGeneratedAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isOfflineCopy, setIsOfflineCopy] = useState(false)
  const unitListRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      setIsOfflineCopy(false)
      try {
        // One call: /api/curriculum/get-outline checks curriculum_outlines
        // itself and generates + saves on a miss, so there's no client-side
        // way to tell "was already cached" from "just generated" anymore —
        // both look identical from here, just possibly slower.
        const result = await getOrGenerateCurriculumOutline(subject.id, grade)
        if (cancelled) return
        setOutline(result.outline_data)
        setGeneratedAt(result.generated_at)
        writeCache(subject.id, grade, { outline_data: result.outline_data, generated_at: result.generated_at })
      } catch (err) {
        if (cancelled) return
        const cached = readCache(subject.id, grade)
        if (cached) {
          setOutline(cached.outline_data)
          setGeneratedAt(cached.generated_at)
          setIsOfflineCopy(true)
        } else {
          console.error('[Curriculum] load failed:', err)
          setError(getErrorMessage(err, t))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
    // t is a stable function for the app's lifetime (see src/lib/i18n.js) —
    // not a real dependency, and including it would reload on every
    // language change for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject.id, subject.name, grade])

  // Deep-link from the daily question screen's curriculum box (see
  // QuestionCard.jsx/StudentFlow.jsx) — auto-expands the matching unit and
  // topic's <details> and scrolls to them. Matched by comparing
  // dataset values in JS (not a CSS attribute selector) so a topic title
  // containing quotes or other selector-special characters can't break the
  // lookup. Runs once per outline load/target pair — re-collapsing a
  // student's own manual expand/collapse elsewhere on the page never
  // re-triggers this, since neither dependency changes from that.
  useEffect(() => {
    if (!outline || !initialUnitNumber) return
    const container = unitListRef.current
    if (!container) return

    const unitEl = [...container.querySelectorAll('details[data-unit-number]')].find(
      (el) => Number(el.dataset.unitNumber) === Number(initialUnitNumber)
    )
    if (!unitEl) return
    unitEl.open = true

    let scrollTarget = unitEl
    if (initialTopicTitle) {
      const topicEl = [...unitEl.querySelectorAll('details[data-topic-title]')].find(
        (el) => el.dataset.topicTitle === initialTopicTitle
      )
      if (topicEl) {
        topicEl.open = true
        scrollTarget = topicEl
      }
    }

    // Let the newly-opened <details> content lay out before scrolling, so
    // the target lands at its real (expanded) position instead of its
    // stale collapsed one.
    requestAnimationFrame(() => scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }, [outline, initialUnitNumber, initialTopicTitle])

  return (
    <div className="screen student-screen">
      <TopBar
        title={`📖 ${subject.name} — Secondary ${gradeToSecondary(grade)} Curriculum`}
        subtitle="Reference guide"
        username={user.username}
        onBack={onBack}
        onLogout={onLogout}
        onLogoClick={onLogoClick}
      />

      {loading && (
        <div className="curriculum-loading">
          <div className="curriculum-spinner" />
          <p>Loading your {subject.name} curriculum guide…</p>
        </div>
      )}

      {error && <p className="form-error">{error}</p>}

      {outline && (
        <>
          {isOfflineCopy && <p className="field-hint">📴 You're offline — showing the last saved copy.</p>}

          <div className="curriculum-unit-list" ref={unitListRef}>
            {outline.units.map((unit) => (
              <details key={unit.unit_number} className="curriculum-unit" data-unit-number={unit.unit_number}>
                <summary className="curriculum-unit-summary">
                  <span className="curriculum-unit-title">
                    Unit {unit.unit_number}: {unit.unit_title}
                  </span>
                  <span className="curriculum-unit-count">
                    {unit.topics.length} topic{unit.topics.length === 1 ? '' : 's'}
                  </span>
                </summary>

                <div className="curriculum-topic-list">
                  {unit.topics.map((topic, i) => (
                    <details key={i} className="curriculum-topic" data-topic-title={topic.topic_title}>
                      <summary className="curriculum-topic-summary">{topic.topic_title}</summary>
                      <div className="curriculum-topic-body">
                        <p className="curriculum-explanation">{topic.explanation}</p>

                        {topic.key_formulas && topic.key_formulas.length > 0 && (
                          <div className="curriculum-box curriculum-box--formulas">
                            <p className="curriculum-box-label">Key Formulas</p>
                            <ul className="curriculum-formula-list">
                              {topic.key_formulas.map((formula, fi) => (
                                <li key={fi}>{formula}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="curriculum-box curriculum-box--example">
                          <p className="curriculum-box-label">Worked Example</p>
                          <p className="curriculum-example-text">{topic.worked_example}</p>
                        </div>

                        <div className="curriculum-box curriculum-box--mistake">
                          <p className="curriculum-box-label">⚠️ Common Mistake</p>
                          <p>{topic.common_mistakes}</p>
                        </div>
                      </div>
                    </details>
                  ))}
                </div>
              </details>
            ))}
          </div>

          {generatedAt && (
            <p className="curriculum-updated">
              {t('curriculum.lastUpdated', {
                date: new Date(generatedAt).toLocaleDateString(LOCALE_FOR_LANGUAGE[i18n.language] || 'en-US'),
              })}
            </p>
          )}
        </>
      )}
    </div>
  )
}
