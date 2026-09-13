import { useState } from 'react'
import { getUploadDetail } from '../../../lib/storage'
import UploadTypeSelectScreen from './UploadTypeSelectScreen'
import UploadCaptureScreen from './UploadCaptureScreen'
import UploadsLibraryScreen from './UploadsLibraryScreen'
import UploadDetailScreen from './UploadDetailScreen'

// initialView: 'select-type' (from the student home "Upload" button),
// 'library' (from the "My Uploads" button), or 'capture' (from the "Upload
// notes" button on a specific Group Notes Calendar day — see
// presetSharedForDate below — which skips straight past the type-select
// step entirely, since sharing is only ever offered for Study Material
// anyway). Once the student has touched the library in this visit (arrived
// there, or used its "+ New Upload"), "back" from select-type/detail
// returns to the library instead of exiting the whole feature — otherwise
// it exits straight to student home (or, for the 'capture' entry point,
// straight back to whichever day of the Notes Calendar they came from).
//
// classContext: { classType, classId, className } | null — passed straight
// through from StudentFlow.jsx to UploadCaptureScreen; only meaningful there
// (see that component's own comment).
//
// presetSharedForDate: set only for the 'capture' initialView above — locks
// uploadType to 'study_material' from the start (no select-type screen to
// pick it on) and is threaded through to UploadCaptureScreen, which locks
// sharing on for that exact day instead of showing the normal opt-in
// checkbox + dropdown.
export default function UploadsFlow({ user, initialView, lockedSubjectId, classContext, presetSharedForDate, onExit, onLogout, onLogoClick }) {
  const [view, setView] = useState(initialView)
  const [uploadType, setUploadType] = useState(presetSharedForDate ? 'study_material' : null)
  const [selectedUpload, setSelectedUpload] = useState(null)
  const [addPagesTarget, setAddPagesTarget] = useState(null)
  const [libraryIsBackTarget, setLibraryIsBackTarget] = useState(initialView === 'library')

  async function handleSelectUpload(uploadId) {
    const detail = await getUploadDetail(uploadId)
    setSelectedUpload(detail)
    setView('detail')
  }

  function handleUploadSaved(upload) {
    setAddPagesTarget(null)
    setSelectedUpload(upload)
    setView('detail')
  }

  function handleAddPages(upload) {
    setAddPagesTarget(upload)
    setLibraryIsBackTarget(true)
    setView('capture')
  }

  function backFromTypeOrDetail() {
    setAddPagesTarget(null)
    if (libraryIsBackTarget) setView('library')
    else onExit()
  }

  if (view === 'select-type') {
    return (
      <UploadTypeSelectScreen
        username={user.username}
        onSelectType={(type) => {
          setUploadType(type)
          setView('capture')
        }}
        onBack={backFromTypeOrDetail}
        onLogout={onLogout}
        onLogoClick={onLogoClick}
        subscriptionStatus={user.subscription_status}
        daysRemainingInTrial={user.days_remaining_in_trial}
      />
    )
  }

  if (view === 'capture') {
    return (
      <UploadCaptureScreen
        user={user}
        uploadType={uploadType}
        lockedSubjectId={lockedSubjectId}
        existingUpload={addPagesTarget}
        classContext={classContext}
        presetSharedForDate={presetSharedForDate}
        onSaved={handleUploadSaved}
        onBack={() => {
          if (addPagesTarget) return backFromTypeOrDetail()
          // Arrived here straight from a Group Notes Calendar day (no
          // type-select step was ever shown) — "back" exits the whole
          // flow rather than landing on a select-type screen the student
          // never saw in the first place.
          if (presetSharedForDate) return onExit()
          setView('select-type')
        }}
        onLogout={onLogout}
        onLogoClick={onLogoClick}
      />
    )
  }

  if (view === 'library') {
    return (
      <UploadsLibraryScreen
        user={user}
        lockedSubjectId={lockedSubjectId}
        onSelectUpload={handleSelectUpload}
        onAddPages={handleAddPages}
        onNewUpload={() => {
          setLibraryIsBackTarget(true)
          setView('select-type')
        }}
        onBack={onExit}
        onLogout={onLogout}
        onLogoClick={onLogoClick}
      />
    )
  }

  // view === 'detail'
  return (
    <UploadDetailScreen
      user={user}
      upload={selectedUpload}
      onBack={backFromTypeOrDetail}
      onLogout={onLogout}
      onLogoClick={onLogoClick}
    />
  )
}
