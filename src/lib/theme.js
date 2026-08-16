// Theme selection — pure logic + DOM/localStorage side effects, kept
// separate from ThemeContext.jsx (the React-facing half) the same way
// src/lib/i18n.js's own localStorage-backed language detection is a plain
// module, not a component. THEMES[0] ('default') is the app's original,
// only-ever theme — every CSS variable it needs already lives unconditioned
// on :root in src/index.css, so selecting it just means "don't set
// data-theme at all" rather than a fourth block of variable overrides to
// keep in sync with :root forever.
//
// Browser-only — the bottom-of-file bootstrap line touches document/
// localStorage as an import side effect, so this must never be imported
// from a serverless function (see src/lib/streak.js's own header comment
// for the exact same hazard). api/student/update-settings.js deliberately
// duplicates THEMES' values rather than importing them for this reason.
export const THEMES = ['default', 'midnight', 'daylight']

export const THEME_STORAGE_KEY = 'zyndal_theme'

// Swatch-preview colors for the Settings picker (SettingsScreen.jsx) — kept
// here as plain data rather than read back out of CSS, since a single
// picker needs to preview all three themes at once regardless of which
// one's data-theme attribute is actually active. Manually kept in sync with
// the real values in src/index.css; each is [background, accent].
export const THEME_PREVIEW_COLORS = {
  default: ['#12081f', '#8a2be2'],
  midnight: ['#0f0a1a', '#7c3aed'],
  daylight: ['#f7f5fb', '#7c3aed'],
}

export function isValidTheme(value) {
  return THEMES.includes(value)
}

// Both reads are wrapped defensively — a privacy-mode browser with storage
// disabled should just fall back to the default theme rather than crash the
// app before it even renders (same reasoning as Scratchpad.jsx's own
// loadStoredHeight/loadHintSeen).
export function loadStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return isValidTheme(stored) ? stored : 'default'
  } catch {
    return 'default'
  }
}

function persistTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Best-effort only — the choice just won't survive a reload on this
    // device; the in-memory application below still applies it right now.
  }
}

// The only place data-theme is ever written — 'default' removes the
// attribute entirely (see THEMES' own comment on why) rather than setting
// data-theme="default", so a stylesheet only ever needs to special-case the
// two NEW themes, never the original.
export function applyTheme(theme) {
  if (theme === 'default') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', theme)
  }
  persistTheme(theme)
}

// Run as an import side effect — main.jsx imports this module before
// createRoot().render(), so data-theme lands on <html> before the first
// paint, the same anti-flash timing i18n.js's own init() relies on for
// language. ThemeProvider's initial React state reads the same
// loadStoredTheme() value, so it starts already in sync with the DOM
// instead of re-applying (and potentially flickering) on mount.
applyTheme(loadStoredTheme())
