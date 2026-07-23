// The one canonical Zyndal wordmark. Rendered as a button (navigates to the
// landing page) everywhere except the landing page itself, where it's just
// the hero visual and has nothing to navigate to.
export default function Logo({ onClick, size = 'small' }) {
  const content = (
    <>
      <span className="zyndal-logo-bolt">⚡</span>
      <span className="zyndal-logo-text">Zyndal</span>
    </>
  )

  if (!onClick) {
    return <div className={`zyndal-logo zyndal-logo--${size}`}>{content}</div>
  }

  return (
    <button type="button" className={`zyndal-logo zyndal-logo--${size}`} onClick={onClick} aria-label="Zyndal home">
      {content}
    </button>
  )
}
