export default function PerfectWeekCelebration({ amount, onClose }) {
  return (
    <div className="perfect-week-celebration">
      <div className="perfect-week-celebration-glow perfect-week-celebration-glow--1" aria-hidden="true" />
      <div className="perfect-week-celebration-glow perfect-week-celebration-glow--2" aria-hidden="true" />
      <div className="perfect-week-celebration-content">
        <p className="perfect-week-celebration-emoji">🏆</p>
        <h1 className="perfect-week-celebration-title">Perfect Week!</h1>
        <p className="perfect-week-celebration-text">
          You could earn <strong>${amount.toFixed(2)}</strong> — your parent has been notified!
        </p>
        <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
          Let's go!
        </button>
      </div>
    </div>
  )
}
