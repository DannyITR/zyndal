// Every API error response carries a `code` (see api/_lib/studentHandler.js
// and its parent/teacher/admin siblings) alongside the raw English
// `message` — this is the one place that turns that code into user-facing
// text, so a caught error's English message is never shown directly.
//
// err.code absent or unrecognized (e.g. a network failure that never
// reached the server, so there's no structured response at all) falls back
// to `fallbackKey` if the caller passed one (its own context-appropriate,
// already-translated message), or the generic errors.generic message
// otherwise.
export function getErrorMessage(err, t, fallbackKey) {
  const code = err?.code
  if (code) {
    const translated = t(`errors.${code}`, { defaultValue: '' })
    if (translated) return translated
  }
  return fallbackKey ? t(fallbackKey) : t('errors.generic')
}
