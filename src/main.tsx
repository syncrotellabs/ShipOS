import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './LocalApp'
import { HostedApp } from './HostedApp'
import { ErrorBoundary } from './ErrorBoundary'
import './global.css'
import './beta.css'

const RootApp = import.meta.env.VITE_SHIPOS_HOSTED === 'true' ? HostedApp : App

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary><RootApp /></ErrorBoundary>
  </StrictMode>,
)
