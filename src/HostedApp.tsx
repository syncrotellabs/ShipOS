import { useEffect, useState } from 'react'
import { BetaNotice, MissionStart } from './LocalApp'
import { ShipOSPage } from './ShipOSPage'
import { initializeLocalState, localApi } from './localState'
import type { LocalSession, WorldState } from './localState'

type HostedReady = { session: LocalSession; world: WorldState }
type HostedStatus = { worldName: string; telemetry: { connected: boolean; stamp: string | null; error: string } }
type RelayDevice = { id: string; label: string; createdAt: string; lastSeenAt: string | null }
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
  const [devices, setDevices] = useState<RelayDevice[]>([])
  const [label, setLabel] = useState('Gaming PC')
  const [newToken, setNewToken] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const refreshDevices = () => localApi<RelayDevice[]>('/api/admin/relay-devices').then(setDevices)
  useEffect(() => { if (administrator) void refreshDevices().catch(() => undefined) }, [administrator])
  const act = async (fn: () => Promise<void>) => {
    setBusy(true); setMessage('')
    try { await fn(); await refreshDevices() } catch (error) { setMessage((error as Error).message) } finally { setBusy(false) }
  }
  return <div className="betaSettings">
    <section className="betaSettingsSection">
      <h3>WordPress access</h3>
      <p>Signed in as <strong>{session.displayName || 'an Echoboard member'}</strong>.</p>
      <p>{administrator ? 'Administrator access: shared ShipOS records can be edited.' : 'Read-only access: you can browse ShipOS and relayed telemetry, but shared records cannot be changed.'}</p>
      <a href="/auth/logout">End this ShipOS session</a>
    </section>
    {administrator && <section className="betaSettingsSection">
      <h3>Gaming PC telemetry relay</h3>
      <p>Create a one-purpose key, then paste it into Configuration on the gaming PC. The helper makes outbound HTTPS uploads to this site; no home-network port is exposed.</p>
      <label>Gaming PC label<input value={label} onChange={event => setLabel(event.target.value)} maxLength={80} placeholder="Gaming PC" /></label>
      <button disabled={busy || !label.trim()} onClick={() => void act(async () => {
        const created = await localApi<RelayDevice & { token: string }>('/api/admin/relay-devices', { label: label.trim() })
        setNewToken(created.token)
        setMessage('Relay key created. Copy it now; the website stores only its hash and cannot show it again.')
      })}>Create relay key</button>
      {newToken && <div className="betaQr"><p><strong>Copy this key now.</strong> It is shown only once.</p><label>Telemetry relay key<input readOnly value={newToken} onFocus={event => event.currentTarget.select()} /></label><button disabled={busy} onClick={() => void navigator.clipboard.writeText(newToken).then(() => setMessage('Relay key copied. Paste it into the local ShipOS Configuration drawer.')).catch(() => setMessage('Automatic copy was blocked. Select the key above and copy it manually.'))}>Copy relay key</button></div>}
      {devices.map(device => <div className="betaDevice" key={device.id}><span>{device.label}<small>{device.lastSeenAt ? `Last upload ${new Date(device.lastSeenAt).toLocaleString()}` : 'Never connected'}</small></span><b>Telemetry upload only</b><button disabled={busy} onClick={() => void act(async () => { await localApi('/api/admin/relay-devices', { id: device.id, revoke: true }); setNewToken('') })}>Revoke</button></div>)}
      <p className="betaMuted">Relay packets may contain position, ship status, nearby contacts, and saved GPS coordinates. Keys cannot read data or control the game.</p>
    </section>}
    {message && <p role="status" className="betaNotice">{message}</p>}
  </div>
}

export function HostedApp() {
  const [ready, setReady] = useState<HostedReady | null>(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState<HostedStatus | null>(null)
  const [page, setPage] = useState<'telemetry' | 'story'>(() => new URLSearchParams(location.search).get('page') === 'story' ? 'story' : 'telemetry')
  useEffect(() => {
    let cancelled = false
    void bootHosted().then(value => { if (!cancelled) { setReady(value); void localApi<HostedStatus>('/api/status').then(setStatus).catch(() => undefined) } }).catch((reason: Error & { status?: number }) => {
      if (reason.status === 401) { window.location.assign('/auth/start'); return }
      if (!cancelled) setError(reason.message)
    })
    const timer = window.setInterval(() => { if (!cancelled) void localApi<HostedStatus>('/api/status').then(setStatus).catch(() => setStatus(current => current ? { ...current, telemetry: { ...current.telemetry, connected: false } } : current)) }, 3000)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [])
  const readOnly = ready?.session.role !== 'admin'
  return <>
    <header className="betaHeader"><a href="/" className="betaBrand" aria-label="ShipOS home">SHIP<span>OS</span><small>HOSTED BETA</small></a><nav aria-label="Main pages"><button aria-current={page === 'telemetry' ? 'page' : undefined} onClick={() => setPage('telemetry')}>Telemetry</button><button aria-current={page === 'story' ? 'page' : undefined} onClick={() => setPage('story')}>Storytelling <small>RP beta</small></button></nav><span className={`betaConnection ${status?.telemetry.connected ? 'live' : ''}`}>{status?.telemetry.connected ? 'Game connected' : readOnly ? 'Read only' : 'Administrator'}</span></header>
    {ready ? <>
      <div className="betaStatus"><span>{status?.worldName || ready.world.name}</span><span>{status?.telemetry.connected ? 'Secure telemetry relay live' : ready.session.role === 'admin' ? 'Administrator editing enabled' : 'Read-only WordPress session'}</span></div>
      {page === 'story' && <MissionStart viewer={readOnly} />}
      <ShipOSPage readOnly={readOnly} worldId={ready.world.worldId} experience={page === 'telemetry' ? 'navigation' : 'console'} configuration={<HostedAccess session={ready.session} />} />
    </> : <section className="betaMission"><h1>{error ? 'ShipOS could not open' : 'Checking your Echoboard account…'}</h1><p>{error || 'WordPress is confirming your session.'}</p>{error && <><a className="betaPrimary" href="/auth/start">Try WordPress again</a> <a href="https://echoboardhq.com/">Return to Echoboard HQ</a></>}</section>}
    <footer className="betaFooter">Free &amp; open source · MIT · Echoboard HQ WordPress access · Hosted records</footer>
    <BetaNotice />
  </>
}
