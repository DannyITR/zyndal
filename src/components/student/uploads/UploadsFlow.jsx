import { useState } from 'react'
import { getUploadDetail } from '../../../lib/storage'
import UploadTypeSelectScreen from './UploadTypeSelectScreen'
import UploadCaptureScreen from './UploadCaptureScreen'
import UploadsLibraryScreen from './UploadsLibraryScreen'
import UploadDetailScreen from './UploadDetailScreen'

// initialView: 'select-type' (from the student home "Upload" button) or
// 'library' (from the "My Uploads" button). Once the student has touched
// the library in this visit (arrived there, or used its "+ New Upload"),
// "back" from select-type/detail returns to the library instead of exiting
// the whole feature — otherwise it exits straight to student home.
export default function UploadsFlow({ user, initialView, lockedSubjectId, onExit, onLogout, onLogoClick }) {
  const [view, setView] = useState(initialView)
  const [uploadType, setUploadType] = useState(null)
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
        onSaved={handleUploadSaved}
        onBack={() => (addPagesTarget ? backFromTypeOrDetail() : setView('select-type'))}
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
