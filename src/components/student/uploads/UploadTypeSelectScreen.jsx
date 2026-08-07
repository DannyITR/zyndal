import TopBar from '../../shared/TopBar'

export default function UploadTypeSelectScreen({
  username,
  onSelectType,
  onBack,
  onLogout,
  onLogoClick,
  subscriptionStatus,
  daysRemainingInTrial,
}) {
  return (
    <div className="screen student-screen">
      <TopBar
        title="📄 Upload"
        subtitle="What are you uploading?"
        username={username}
        onBack={onBack}
        onLogout={onLogout}
        onLogoClick={onLogoClick}
        subscriptionStatus={subscriptionStatus}
        daysRemainingInTrial={daysRemainingInTrial}
      />

      <div className="upload-type-grid">
        <button type="button" className="upload-type-card" onClick={() => onSelectType('test')}>
          <span className="upload-type-emoji">📝</span>
          <span className="upload-type-title">Upload a Test I got back</span>
          <span className="upload-type-detail">Graded test — record your grade and get a payout suggestion</span>
        </button>

        <button type="button" className="upload-type-card" onClick={() => onSelectType('study_material')}>
          <span className="upload-type-emoji">📚</span>
          <span className="upload-type-title">Upload Study Material</span>
          <span className="upload-type-detail">Textbook pages, worksheets, or class notes</span>
        </button>
      </div>
    </div>
  )
}
