import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './LocalApp'
import { ErrorBoundary } from './ErrorBoundary'
import './global.css'
import './beta.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary><App /></ErrorBoundary>
  </StrictMode>,
)
