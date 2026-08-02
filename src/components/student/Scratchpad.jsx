import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

// Scratchpad is Math-only — other subjects may be added in future.

const PEN_COLOR = '#1a1a1a'
const PEN_WIDTH = 3
const ERASER_WIDTH = 22
const BACKGROUND_COLOR = '#ffffff'

const MIN_HEIGHT = 150
const MAX_HEIGHT = 500
const DEFAULT_HEIGHT = 200
const EXPANDED_HEIGHT = 400
const HEIGHT_STORAGE_KEY = 'zyndal_scratchpad_height'
const HINT_SEEN_KEY = 'zyndal_scratchpad_resize_hint_seen'

function clampHeight(h) {
  return Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, h))
}

// Both localStorage reads are wrapped defensively — a privacy-mode browser
// with storage disabled should just fall back to the built-in defaults
// (and never nag with a hint it can't actually remember dismissing) rather
// than crash the component.
function loadStoredHeight() {
  try {
    const parsed = Number(localStorage.getItem(HEIGHT_STORAGE_KEY))
    return Number.isFinite(parsed) && parsed > 0 ? clampHeight(parsed) : DEFAULT_HEIGHT
  } catch {
    return DEFAULT_HEIGHT
  }
}

function loadHintSeen() {
  try {
    return localStorage.getItem(HINT_SEEN_KEY) === '1'
  } catch {
    return true
  }
}

// Coordinates in every stroke are stored in CSS pixels (relative to the
// canvas's own bounding box), not physical device pixels — that keeps them
// valid across devicePixelRatio and container-width/height changes, since
// the canvas is re-scaled (see setupCanvas) and fully redrawn from
// `strokes` whenever its size changes (including a resize drag), rather
// than the pixel buffer itself being stretched.
function getPoint(e, canvas) {
  const rect = canvas.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

function drawStroke(ctx, stroke) {
  if (stroke.points.length === 0) return
  ctx.strokeStyle = stroke.tool === 'eraser' ? BACKGROUND_COLOR : PEN_COLOR
  ctx.lineWidth = stroke.tool === 'eraser' ? ERASER_WIDTH : PEN_WIDTH
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (stroke.points.length === 1) {
    // A tap with no movement — draw a dot so a single touch still leaves a
    // visible mark instead of nothing.
    const [p] = stroke.points
    ctx.beginPath()
    ctx.arc(p.x, p.y, ctx.lineWidth / 2, 0, Math.PI * 2)
    ctx.fillStyle = ctx.strokeStyle
    ctx.fill()
    return
  }
  ctx.beginPath()
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
  for (let i = 1; i < stroke.points.length; i++) ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
  ctx.stroke()
}

const Scratchpad = forwardRef(function Scratchpad({ disabled, onDrawingChange }, ref) {
  const { t } = useTranslation()
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const strokesRef = useRef([]) // finalized strokes
  const currentStrokeRef = useRef(null) // in-progress stroke, or null
  const [tool, setTool] = useState('pen')
  const [isEmpty, setIsEmpty] = useState(true)

  // Resizable canvas — height is a student preference, remembered across
  // visits. expanded tracks only the Expand/Collapse button's own toggle
  // (a temporary jump to EXPANDED_HEIGHT and back), not the persisted
  // drag-resize preference — dragging the handle always exits it.
  const [height, setHeight] = useState(loadStoredHeight)
  const [expanded, setExpanded] = useState(false)
  const [showResizeHint, setShowResizeHint] = useState(() => !loadHintSeen())
  const preExpandHeightRef = useRef(height)

  function render() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
    ctx.fillStyle = BACKGROUND_COLOR
    ctx.fillRect(0, 0, rect.width, rect.height)
    for (const stroke of strokesRef.current) drawStroke(ctx, stroke)
    if (currentStrokeRef.current) drawStroke(ctx, currentStrokeRef.current)
  }

  function setupCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    render()
  }

  useEffect(() => {
    setupCanvas()
    if (!containerRef.current || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => setupCanvas())
    observer.observe(containerRef.current)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function updateEmpty() {
    const empty = strokesRef.current.length === 0
    setIsEmpty(empty)
    onDrawingChange?.(!empty)
  }

  function handlePointerDown(e) {
    if (disabled) return
    e.preventDefault()
    canvasRef.current.setPointerCapture(e.pointerId)
    currentStrokeRef.current = { tool, points: [getPoint(e, canvasRef.current)] }
    render()
  }

  function handlePointerMove(e) {
    if (disabled || !currentStrokeRef.current) return
    e.preventDefault()
    currentStrokeRef.current.points.push(getPoint(e, canvasRef.current))
    render()
  }

  function finishStroke() {
    if (!currentStrokeRef.current) return
    strokesRef.current = [...strokesRef.current, currentStrokeRef.current]
    currentStrokeRef.current = null
    render()
    updateEmpty()
  }

  function handleUndo() {
    if (disabled || strokesRef.current.length === 0) return
    strokesRef.current = strokesRef.current.slice(0, -1)
    render()
    updateEmpty()
  }

  function handleClear() {
    if (disabled || strokesRef.current.length === 0) return
    strokesRef.current = []
    render()
    updateEmpty()
  }

  function dismissResizeHint() {
    if (!showResizeHint) return
    setShowResizeHint(false)
    try {
      localStorage.setItem(HINT_SEEN_KEY, '1')
    } catch {
      // Best-effort only — the hint just reappears next load, harmless.
    }
  }

  // Drag-to-resize — tracked on window (not via setPointerCapture) so the
  // drag keeps following the pointer even once it leaves the thin handle
  // strip. latestHeight is a plain closure variable, not React state, so
  // onPointerUp always sees the true final value rather than a stale one.
  function handleResizeStart(e) {
    e.preventDefault()
    dismissResizeHint()
    setExpanded(false)
    const startY = e.clientY
    const startHeight = height
    let latestHeight = startHeight
    function onPointerMove(moveEvent) {
      latestHeight = clampHeight(startHeight + (moveEvent.clientY - startY))
      setHeight(latestHeight)
    }
    function onPointerUp() {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      try {
        localStorage.setItem(HEIGHT_STORAGE_KEY, String(latestHeight))
      } catch {
        // Best-effort persistence only.
      }
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  function handleToggleExpand() {
    if (expanded) {
      setHeight(preExpandHeightRef.current)
      setExpanded(false)
    } else {
      preExpandHeightRef.current = height
      setHeight(EXPANDED_HEIGHT)
      setExpanded(true)
    }
  }

  useImperativeHandle(ref, () => ({
    toDataURL: () => canvasRef.current?.toDataURL('image/png'),
    isEmpty: () => strokesRef.current.length === 0,
  }))

  return (
    <div className="scratchpad" ref={containerRef}>
      <div className="scratchpad-canvas-wrap" style={{ height: `${height}px` }}>
        <canvas
          ref={canvasRef}
          className="scratchpad-canvas"
          style={{ touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishStroke}
          onPointerLeave={finishStroke}
          onPointerCancel={finishStroke}
        />
        {isEmpty && <p className="scratchpad-placeholder">{t('scratchpad.placeholder')}</p>}

        <button type="button" className="scratchpad-expand-btn" onClick={handleToggleExpand}>
          {expanded ? t('scratchpad.collapse') : t('scratchpad.expand')}
        </button>

        <div className="scratchpad-resize-handle" style={{ touchAction: 'none' }} onPointerDown={handleResizeStart}>
          <span className="scratchpad-resize-grip" />
        </div>

        {showResizeHint && <p className="scratchpad-resize-hint">{t('scratchpad.dragHint')}</p>}
      </div>
      <div className="scratchpad-toolbar">
        <button
          type="button"
          className={`scratchpad-tool-btn ${tool === 'pen' ? 'scratchpad-tool-btn--active' : ''}`}
          disabled={disabled}
          onClick={() => setTool('pen')}
        >
          {t('scratchpad.draw')}
        </button>
        <button
          type="button"
          className={`scratchpad-tool-btn ${tool === 'eraser' ? 'scratchpad-tool-btn--active' : ''}`}
          disabled={disabled}
          onClick={() => setTool('eraser')}
        >
          {t('scratchpad.eraser')}
        </button>
        <button type="button" className="scratchpad-tool-btn" disabled={disabled || isEmpty} onClick={handleUndo}>
          {t('scratchpad.undo')}
        </button>
        <button type="button" className="scratchpad-tool-btn" disabled={disabled || isEmpty} onClick={handleClear}>
          {t('scratchpad.clear')}
        </button>
      </div>
    </div>
  )
})

export default Scratchpad
