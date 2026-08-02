// i18n must be the very first import — it runs i18next.init() as an import
// side effect, which needs to happen before App (or anything it renders)
// can call useTranslation()/access the i18next instance.
import i18n from './lib/i18n'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { I18nextProvider } from 'react-i18next'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <App />
    </I18nextProvider>
  </StrictMode>,
)

// Only register in production builds — in dev, a service worker caching
// unbundled /src modules would fight Vite's HMR and serve stale code.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('[PWA] service worker registration failed:', err)
    })
  })
}
