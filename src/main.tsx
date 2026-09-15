import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { applyTheme, getStoredThemePreference } from './theme'
import { App, LandingApp } from './lazyRoutes'

applyTheme(getStoredThemePreference())

const canonicalLink = document.createElement('link')
canonicalLink.rel = 'canonical'
canonicalLink.href = `${window.location.origin}/`
document.head.appendChild(canonicalLink)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>
      {window.location.pathname === '/' ? <LandingApp /> : <App />}
    </Suspense>
  </StrictMode>,
)
