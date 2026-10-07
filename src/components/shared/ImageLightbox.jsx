import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const MAX_SCALE = 4
const DOUBLE_TAP_SCALE = 2.5
const DOUBLE_TAP_MS = 300
const TAP_SLOP_PX = 8
const SWIPE_THRESHOLD_PX = 60

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

// Full-screen viewer for a set of page images: pinch / double-tap / wheel to
// zoom, drag to pan while zoomed, and swipe / arrow keys / on-screen arrows
// to move between pages. images: [{ url, mediaType }] — a PDF page can't be
// rendered inline as an <img>, so it gets an "open" link in place of the
// zoomable image instead.
//
// Zoom/pan state lives in a ref and is written straight to the <img>'s
// transform rather than going through React state, so a pinch doesn't
// re-render the whole component on every pointermove.
export default function ImageLightbox({ images, startIndex = 0, title, onClose }) {
  const { t } = useTranslation()
  const [index, setIndex] = useState(clamp(startIndex, 0, images.length - 1))
  const [failed, setFailed] = useState({})
  const stageRef = useRef(null)
  const imgRef = useRef(null)
  const closeRef = useRef(null)
  const view = useRef({ scale: 1, x: 0, y: 0 })
  const pointers = useRef(new Map())
  const gesture = useRef(null)
  const lastTapAt = useRef(0)

  const current = images[index]
  const isPdf = current.mediaType === 'application/pdf'
  const hasMultiple = images.length > 1

  function applyView() {
    const img = imgRef.current
    const stage = stageRef.current
    if (!img || !stage) return
    const v = view.current
    // Never let the image be dragged further than its own zoomed overflow —
    // at scale 1 this pins it dead centre.
    const maxX = Math.max(0, (img.offsetWidth * v.scale - stage.clientWidth) / 2)
    const maxY = Math.max(0, (img.offsetHeight * v.scale - stage.clientHeight) / 2)
    v.x = clamp(v.x, -maxX, maxX)
    v.y = clamp(v.y, -maxY, maxY)
    img.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.scale})`
    stage.classList.toggle('lightbox-stage--zoomed', v.scale > 1)
  }

  function resetView() {
    view.current = { scale: 1, x: 0, y: 0 }
    applyView()
  }

  // Zooms to `scale` keeping the point under (clientX, clientY) stationary.
  function zoomAt(scale, clientX, clientY, from = view.current) {
    const rect = stageRef.current.getBoundingClientRect()
    const cx = clientX - (rect.left + rect.width / 2)
    const cy = clientY - (rect.top + rect.height / 2)
    const next = clamp(scale, 1, MAX_SCALE)
    const ratio = next / from.scale
    view.current = { scale: next, x: cx - (cx - from.x) * ratio, y: cy - (cy - from.y) * ratio }
    applyView()
  }

  function go(delta) {
    const next = index + delta
    if (next < 0 || next >= images.length) return
    setIndex(next)
  }

  useEffect(() => {
    pointers.current.clear()
    gesture.current = null
    resetView()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, images.length, onClose])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  function startSinglePointerGesture(pointer) {
    gesture.current = {
      type: view.current.scale > 1 ? 'pan' : 'swipe',
      startX: pointer.x,
      startY: pointer.y,
      originX: view.current.x,
      originY: view.current.y,
      moved: false,
    }
  }

  function handlePointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      gesture.current = {
        type: 'pinch',
        startDistance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        from: { ...view.current },
      }
    } else if (pointers.current.size === 1) {
      startSinglePointerGesture({ x: e.clientX, y: e.clientY })
      gesture.current.onBackdrop = e.target === e.currentTarget
    }
  }

  function handlePointerMove(e) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    if (!g) return

    if (g.type === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      zoomAt(g.from.scale * (distance / g.startDistance), (a.x + b.x) / 2, (a.y + b.y) / 2, g.from)
      return
    }

    const dx = e.clientX - g.startX
    const dy = e.clientY - g.startY
    if (Math.abs(dx) > TAP_SLOP_PX || Math.abs(dy) > TAP_SLOP_PX) g.moved = true
    if (g.type === 'pan') {
      view.current.x = g.originX + dx
      view.current.y = g.originY + dy
      applyView()
    }
  }

  function handleTap(e, onBackdrop) {
    // Tapping the dark area around the page closes the viewer; tapping the
    // page itself only ever zooms (on the second tap), so a slightly-off
    // double-tap can't dismiss it by accident.
    if (onBackdrop) {
      onClose()
      return
    }
    const now = Date.now()
    if (now - lastTapAt.current < DOUBLE_TAP_MS) {
      lastTapAt.current = 0
      if (view.current.scale > 1) resetView()
      else zoomAt(DOUBLE_TAP_SCALE, e.clientX, e.clientY)
    } else {
      lastTapAt.current = now
    }
  }

  function handlePointerUp(e) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.delete(e.pointerId)
    const g = gesture.current
    if (!g) return

    if (g.type === 'pinch') {
      // One finger lifted mid-pinch: carry on as a pan with the other one
      // instead of jumping, and snap back if they pinched all the way out.
      if (view.current.scale <= 1.02) resetView()
      const [remaining] = [...pointers.current.values()]
      if (remaining) {
        startSinglePointerGesture(remaining)
        gesture.current.moved = true
      } else {
        gesture.current = null
      }
      return
    }

    gesture.current = null
    if (e.type === 'pointercancel') return
    const dx = e.clientX - g.startX
    const dy = e.clientY - g.startY
    if (!g.moved) handleTap(e, g.onBackdrop)
    else if (g.type === 'swipe' && Math.abs(dx) > SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1)
  }

  function handleWheel(e) {
    zoomAt(view.current.scale * Math.exp(-e.deltaY * 0.002), e.clientX, e.clientY)
  }

  const gestureHandlers = isPdf
    ? {}
    : {
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerUp,
        onPointerCancel: handlePointerUp,
        onWheel: handleWheel,
      }

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={title || t('lightbox.label')}>
      <div className="lightbox-bar">
        <p className="lightbox-title">
          {title}
          {hasMultiple && <span className="lightbox-counter">{t('lightbox.counter', { current: index + 1, total: images.length })}</span>}
        </p>
        <button ref={closeRef} type="button" className="lightbox-btn" onClick={onClose} aria-label={t('common.close')}>
          ✕
        </button>
      </div>

      <div ref={stageRef} className="lightbox-stage" {...gestureHandlers}>
        {isPdf ? (
          <div className="lightbox-message">
            <span className="upload-preview-file-icon">📄</span>
            <a className="btn btn-primary" href={current.url} target="_blank" rel="noopener noreferrer">
              {t('lightbox.openPdf')}
            </a>
          </div>
        ) : failed[index] ? (
          <p className="lightbox-message">{t('lightbox.loadError')}</p>
        ) : (
          <img
            key={current.url}
            ref={imgRef}
            className="lightbox-image"
            src={current.url}
            alt={t('lightbox.pageAlt', { current: index + 1, total: images.length })}
            draggable={false}
            onLoad={applyView}
            onError={() => setFailed((prev) => ({ ...prev, [index]: true }))}
          />
        )}
      </div>

      {hasMultiple && (
        <>
          <button type="button" className="lightbox-btn lightbox-nav lightbox-nav--prev" onClick={() => go(-1)} disabled={index === 0} aria-label={t('lightbox.previous')}>
            ←
          </button>
          <button
            type="button"
            className="lightbox-btn lightbox-nav lightbox-nav--next"
            onClick={() => go(1)}
            disabled={index === images.length - 1}
            aria-label={t('lightbox.next')}
          >
            →
          </button>
        </>
      )}
    </div>
  )
}
