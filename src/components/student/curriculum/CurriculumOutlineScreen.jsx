import { useEffect, useState } from 'react'
import { getCurriculumOutline, saveCurriculumOutline } from '../../../lib/storage'
import { generateCurriculumOutline } from '../../../lib/ai'
import { gradeToSecondary } from '../../../lib/questions'
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

export default function CurriculumOutlineScreen({ user, subject, onBack, onLogout, onLogoClick }) {
  const grade = user.grade || 9
  const [outline, setOutline] = useState(null)
  const [generatedAt, setGeneratedAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [isOfflineCopy, setIsOfflineCopy] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setGenerating(false)
      setError('')
      setIsOfflineCopy(false)
      try {
        const existing = await getCurriculumOutline(subject.id, grade)
        if (cancelled) return

        if (existing) {
          setOutline(existing.outline_data)
          setGeneratedAt(existing.generated_at)
          writeCache(subject.id, grade, { outline_data: existing.outline_data, generated_at: existing.generated_at })
        } else {
          setGenerating(true)
          const generated = await generateCurriculumOutline({ grade, subjectName: subject.name })
          if (cancelled) return
          const saved = await saveCurriculumOutline(subject.id, grade, generated)
          if (cancelled) return
          setOutline(saved.outline_data)
          setGeneratedAt(saved.generated_at)
          writeCache(subject.id, grade, { outline_data: saved.outline_data, generated_at: saved.generated_at })
        }
      } catch (err) {
        if (cancelled) return
        const cached = readCache(subject.id, grade)
        if (cached) {
          setOutline(cached.outline_data)
          setGeneratedAt(cached.generated_at)
          setIsOfflineCopy(true)
        } else {
          console.error('[Curriculum] load failed:', err)
          setError(err.message || "Couldn't load the curriculum outline. Please try again.")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
          setGenerating(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [subject.id, subject.name, grade])

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
          <p>
            {generating
              ? `Generating your ${subject.name} curriculum guide… this only happens once!`
              : 'Loading your curriculum guide…'}
          </p>
        </div>
      )}

      {error && <p className="form-error">{error}</p>}

      {outline && (
        <>
          {isOfflineCopy && <p className="field-hint">📴 You're offline — showing the last saved copy.</p>}

          <div className="curriculum-unit-list">
            {outline.units.map((unit) => (
              <details key={unit.unit_number} className="curriculum-unit">
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
                    <details key={i} className="curriculum-topic">
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
            <p className="curriculum-updated">Last updated: {new Date(generatedAt).toLocaleDateString()}</p>
          )}
        </>
      )}
    </div>
  )
}
