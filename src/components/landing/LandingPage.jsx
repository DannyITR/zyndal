import Logo from '../shared/Logo'

export default function LandingPage({ onSignUp, onLogIn }) {
  return (
    <div className="landing-screen">
      <div className="landing-glow landing-glow--1" aria-hidden="true" />
      <div className="landing-glow landing-glow--2" aria-hidden="true" />

      <div className="landing-hero">
        <Logo size="large" />
        <p className="landing-tagline">Learn daily. Earn real.</p>
        <p className="landing-description">
          Answer one quick question a day in every subject, build your streak, and earn real
          coins your parents can pay out. Climb the leaderboard and see how you stack up.
        </p>
      </div>

      <div className="landing-actions">
        <button type="button" className="btn btn-primary btn-block" onClick={onSignUp}>
          Sign Up
        </button>
        <button type="button" className="btn btn-secondary btn-block" onClick={onLogIn}>
          Log In
        </button>
      </div>
    </div>
  )
}
