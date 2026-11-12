import { useEffect, useState } from 'react'
import { BetaNotice, MissionStart } from './LocalApp'
import { ShipOSPage } from './ShipOSPage'
import { initializeLocalState, localApi } from './localState'
import type { LocalSession, WorldState } from './localState'

type HostedReady = { session: LocalSession; world: WorldState }
let hostedBoot: Promise<HostedReady> | undefined

function bootHosted() {
  return hostedBoot ??= (async () => {
    const session = await localApi<LocalSession>('/api/session')
    const world = await localApi<WorldState>('/api/state')
    initializeLocalState(session, world)
    return { session, world }
  })()
}

function HostedAccess({ session }: { session: LocalSession }) {
  const administrator = session.role === 'admin'
  return <section className="betaSettingsSection">
    <h3>WordPress access</h3>
    <p>Signed in as <strong>{session.displayName || 'an Echoboard member'}</strong>.</p>
    <p>{administrator ? 'Administrator access: shared ShipOS records can be edited.' : 'Read-only access: you can browse ShipOS, but shared records cannot be changed.'}</p>
    <a href="/auth/logout">End this ShipOS session</a>
  </section>
}

export function HostedApp() {
  const [ready, setReady] = useState<HostedReady | null>(null)
  const [error, setError] = useState('')
  const [page, setPage] = useState<'telemetry' | 'story'>(() => new URLSearchParams(location.search).get('page') === 'story' ? 'story' : 'telemetry')
  useEffect(() => {
    let cancelled = false
    void bootHosted().then(value => { if (!cancelled) setReady(value) }).catch((reason: Error & { status?: number }) => {
      if (reason.status === 401) { window.location.assign('/auth/start'); return }
      if (!cancelled) setError(reason.message)
    })
    return () => { cancelled = true }
  }, [])
  const readOnly = ready?.session.role !== 'admin'
  return <>
    <header className="betaHeader"><a href="/" className="betaBrand" aria-label="ShipOS home">SHIP<span>OS</span><small>HOSTED BETA</small></a><nav aria-label="Main pages"><button aria-current={page === 'telemetry' ? 'page' : undefined} onClick={() => setPage('telemetry')}>Telemetry</button><button aria-current={page === 'story' ? 'page' : undefined} onClick={() => setPage('story')}>Storytelling <small>RP beta</small></button></nav><span className="betaConnection">{readOnly ? 'Read only' : 'Administrator'}</span></header>
    {ready ? <>
      <div className="betaStatus"><span>{ready.world.name}</span><span>{ready.session.role === 'admin' ? 'Administrator editing enabled' : 'Read-only WordPress session'}</span></div>
      {page === 'story' && <MissionStart viewer={readOnly} />}
      <ShipOSPage readOnly={readOnly} worldId={ready.world.worldId} experience={page === 'telemetry' ? 'navigation' : 'console'} configuration={<HostedAccess session={ready.session} />} />
    </> : <section className="betaMission"><h1>{error ? 'ShipOS could not open' : 'Checking your Echoboard account…'}</h1><p>{error || 'WordPress is confirming your session.'}</p>{error && <><a className="betaPrimary" href="/auth/start">Try WordPress again</a> <a href="https://echoboardhq.com/">Return to Echoboard HQ</a></>}</section>}
    <footer className="betaFooter">Free &amp; open source · MIT · Echoboard HQ WordPress access · Hosted records</footer>
    <BetaNotice />
  </>
}
