import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { ShipOSPage } from './ShipOSPage'
import { downloadRecovery, initializeLocalState, localApi, synchronize, usePersistentState } from './localState'
import type { LocalSession, WorldState } from './localState'

type Status = {
  version: string; worldId: string; worldName: string; dataDir?: string
  telemetry: { connected: boolean; stamp: string | null; error: string; stableWorldIdentity: boolean; watchFile?: string }
  sharing: { enabled: boolean; url: string | null; address: string | null; addresses?: string[] }
  ai: { enabled: boolean; model: string }
}
type Device = { id: string; label: string; role: 'editor' }
let bootPromise: Promise<{ session: LocalSession; world: WorldState }> | undefined
function boot() {
  return bootPromise ??= (async () => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('pair')
    if (token) {
      window.history.replaceState({}, '', window.location.pathname + window.location.search)
      await localApi('/api/pair/claim', { token, label: /iPad|iPhone|Macintosh/.test(navigator.userAgent) ? 'Apple tablet / browser' : 'Tablet / browser' })
    }
    const session = await localApi<LocalSession>('/api/session')
    const world = await localApi<WorldState>('/api/state')
    initializeLocalState(session, world)
    return { session, world }
  })()
}

function BetaNotice() {
  const dialog = useRef<HTMLDialogElement>(null)
  const [accepted, setAccepted] = useState(() => localStorage.getItem('shipos-beta-notice-v2') === 'accepted')
  useEffect(() => { if (!accepted && dialog.current && !dialog.current.open) dialog.current.showModal() }, [accepted])
  if (accepted) return null
  return <dialog className="betaDialog" ref={dialog} aria-labelledby="beta-title" onCancel={event => event.preventDefault()}>
    <span className="betaEyebrow">Welcome aboard · 0.2 beta</span>
    <h2 id="beta-title">Your game. Your story.<br />Still a work in progress.</h2>
    <p>ShipOS is a free, open-source companion for local, single-player Space Engineers.</p>
    <p><strong>Storytelling and AI roleplay are especially experimental.</strong> Fictional messages, missions, accounts, and advice are not live game facts. ShipOS does not control your game.</p>
    <p>Your records stay on the gaming PC. Optional tablet sharing works on your trusted local network only; optional AI uses a model running on that PC.</p>
    <p className="betaMuted">Back up important stories. If telemetry goes stale, the screen shows the last known reading.</p>
    <button autoFocus className="betaPrimary" onClick={() => { localStorage.setItem('shipos-beta-notice-v2', 'accepted'); dialog.current?.close(); setAccepted(true) }}>Got it — let’s play</button>
  </dialog>
}

function MissionStart({ viewer }: { viewer: boolean }) {
  const [mission, setMission] = usePersistentState('shipos-mission', { title: '', goal: '', startedAt: '' })
  const [title, setTitle] = useState('')
  const [goal, setGoal] = useState('')
  if (mission.startedAt) return <section className="betaMission"><span className="betaEyebrow">Current story · player-defined</span><h2>{mission.title}</h2><p>{mission.goal || 'No goal recorded yet. Explore at your own pace.'}</p></section>
  return <section className="betaMission">
    <span className="betaEyebrow">A clean slate</span><h2>One engineer. A planet. Your next move.</h2>
    <p>Start from your Star System surface landing. No pre-written crew, wealth, contracts, or voyage. Add those only when they belong in your story.</p>
    <form onSubmit={event => { event.preventDefault(); setMission({ title: title.trim() || 'A new beginning', goal: goal.trim(), startedAt: new Date().toISOString() }) }}>
      <fieldset disabled={viewer}><label>Mission name<input value={title} onChange={event => setTitle(event.target.value)} maxLength={100} placeholder="A new beginning" /></label>
      <label>First small goal<input value={goal} onChange={event => setGoal(event.target.value)} maxLength={500} placeholder="Find shelter, establish power, explore…" /></label>
      <button className="betaPrimary">Begin this story</button></fieldset>
    </form>
  </section>
}

function LocalSettings({ session, status, refresh }: { session: LocalSession; status: Status | null; refresh: () => Promise<void> }) {
  const [address, setAddress] = useState('')
  const [qr, setQr] = useState('')
  const [pairUrl, setPairUrl] = useState('')
  const [expires, setExpires] = useState(0)
  const [devices, setDevices] = useState<Device[]>([])
  const [model, setModel] = useState(status?.ai.model || '')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [resetText, setResetText] = useState('')
  const [now, setNow] = useState(Date.now())
  const admin = session.role === 'admin'
  useEffect(() => {
    if (admin) void localApi<Device[]>('/api/admin/devices').then(setDevices).catch(() => undefined)
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [admin])
  useEffect(() => { setModel(status?.ai.model || '') }, [status?.ai.model])
  const act = async (fn: () => Promise<void>) => {
    setBusy(true); setMessage('')
    try { await fn(); await refresh(); if (admin) setDevices(await localApi<Device[]>('/api/admin/devices')) }
    catch (error) { setMessage((error as Error).message) }
    finally { setBusy(false) }
  }
  if (!admin) return <section className="betaSettingsSection"><h3>Paired play screen</h3><p>Story read/write is enabled automatically. There is no account or login; changes are saved on the gaming PC. Sharing, backups, device revocation, and AI configuration stay on the PC.</p></section>
  return <div className="betaSettings">
    <section className="betaSettingsSection"><h3>iPad & local-network sharing</h3>
      <p>Use only a trusted home network. This beta uses local HTTP, not encrypted HTTPS. Never forward its port to the internet.</p>
      <label>PC network address<select value={address || status?.sharing.address || status?.sharing.addresses?.[0] || ''} onChange={event => setAddress(event.target.value)}>{status?.sharing.addresses?.map(ip => <option key={ip}>{ip}</option>)}</select></label>
      <div className="betaActions"><button disabled={busy || !status?.sharing.addresses?.length} onClick={() => void act(async () => {
        await localApi('/api/admin/sharing', { enabled: !status?.sharing.enabled, address: address || status?.sharing.address || status?.sharing.addresses?.[0] }); setQr(''); setPairUrl('')
      })}>{status?.sharing.enabled ? 'Turn sharing off' : 'Enable local sharing'}</button>
      <button disabled={busy || !status?.sharing.enabled} onClick={() => void act(async () => {
        const pair = await localApi<{ url: string; expires: number }>('/api/admin/pair', {})
        setQr(await QRCode.toDataURL(pair.url, { width: 320, margin: 2, color: { dark: '#102329', light: '#ffffff' } })); setPairUrl(pair.url); setExpires(pair.expires)
      })}>Generate pairing QR</button></div>
      {qr && <div className="betaQr">{expires > now ? <><img src={qr} alt="Single-use ShipOS tablet pairing QR" /><p>Scan with an iPad/Android camera, or copy the link to another PC on the same network.<br />Single use · expires in {Math.ceil((expires - now) / 1000)} seconds · story read/write included. No account or login.</p><label>Pairing link<input readOnly value={pairUrl} onFocus={event => event.currentTarget.select()} /></label><button disabled={busy} onClick={() => void navigator.clipboard.writeText(pairUrl).then(() => setMessage('Pairing link copied. Open it once on the other device.')).catch(() => setMessage('Automatic copy was blocked. Select the link above and copy it manually.'))}>Copy pairing link</button></> : <p>This QR has expired. Generate a new one.</p>}</div>}
      <p className="betaMuted">If Safari cannot connect, check Windows Firewall and Wi-Fi client isolation. Allow ShipOS only on a trusted private network. No public-network rule is installed automatically.</p>
      {devices.map(device => <div className="betaDevice" key={device.id}><span>{device.label}</span><b>Story read + write</b><button onClick={() => void act(async () => { await localApi('/api/admin/devices', { id: device.id, revoke: true }) })}>Revoke</button></div>)}
    </section>
    <section className="betaSettingsSection"><h3>Optional local AI</h3><p>Connect an already-installed local model server at <code>127.0.0.1:11434</code> using its OpenAI-compatible API. ShipOS does not download models or contact cloud AI.</p>
      <label>Installed model name<input value={model} onChange={event => setModel(event.target.value)} placeholder="Exact name from your local model server" maxLength={160} /></label>
      <div className="betaActions"><button disabled={busy || !model.trim()} onClick={() => void act(async () => { await localApi('/api/admin/ai', { model: model.trim(), enabled: true }); setMessage('Local AI enabled. Switch to Storytelling to use it.'); window.dispatchEvent(new Event('shipos:ai-settings')) })}>Enable local AI</button><button disabled={busy} onClick={() => void act(async () => { await localApi('/api/admin/ai', { model: model.trim(), enabled: false }); window.dispatchEvent(new Event('shipos:ai-settings')) })}>Disable AI</button></div>
    </section>
    <section className="betaSettingsSection"><h3>Story data & recovery</h3><p>SQLite database on this PC. Each identified game world has separate story records. Reset and restore create a local snapshot first; the newest 30 snapshots are kept.</p>
      <p className="betaMuted">{status?.dataDir}</p>
      <div className="betaActions"><a href="/api/admin/backup" download>Download story backup</a><button onClick={downloadRecovery}>Download unsaved draft</button>
      <label className="betaFile">Restore backup<input type="file" accept=".json,application/json" onChange={event => { const file = event.target.files?.[0]; if (!file) return; void act(async () => {
        if (file.size > 13000000) throw Error('Backup exceeds the 13 MB limit.')
        const backup = JSON.parse(await file.text())
        if (!window.confirm('Replace this world’s story with this backup? A snapshot of the current story will be kept.')) return
        await synchronize(); const state = await localApi<WorldState>('/api/state')
        await localApi('/api/admin/restore', { backup, worldId: state.worldId, expectedRevision: state.revision }); window.location.reload()
      }) }} /></label></div>
      <details><summary>Start over in this world</summary><p>Clears ShipOS story records only, not your Space Engineers save or old browser profile.</p><label>Type NEW MISSION<input value={resetText} onChange={event => setResetText(event.target.value)} /></label><button className="betaDanger" disabled={busy || resetText !== 'NEW MISSION'} onClick={() => void act(async () => {
        await synchronize(); const state = await localApi<WorldState>('/api/state')
        await localApi('/api/admin/reset', { confirm: resetText, worldId: state.worldId, expectedRevision: state.revision }); window.location.reload()
      })}>Back up & reset story</button></details>
    </section>
    {message && <p role="status" className="betaNotice">{message}</p>}
  </div>
}

export function App() {
  const [ready, setReady] = useState<{ session: LocalSession; world: WorldState } | null>(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState<Status | null>(null)
  const [page, setPage] = useState<'telemetry' | 'story'>(() => new URLSearchParams(location.search).get('page') === 'story' ? 'story' : 'telemetry')
  const [sync, setSync] = useState('Saved on this PC')
  const refresh = async () => { setStatus(await localApi<Status>('/api/status')) }
  useEffect(() => {
    let cancelled = false
    void boot().then(result => { if (!cancelled) { setReady(result); void refresh().catch(() => undefined) } }).catch(error => { if (!cancelled) setError(error.message) })
    const timer = window.setInterval(() => { if (!cancelled) void refresh().catch(() => setStatus(current => current ? { ...current, telemetry: { ...current.telemetry, connected: false } } : current)) }, 3000)
    const syncListener = (event: Event) => setSync((event as CustomEvent<string>).detail)
    window.addEventListener('shipos:sync-status', syncListener)
    return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener('shipos:sync-status', syncListener) }
  }, [])
  return <>
    <header className="betaHeader"><a href="/" className="betaBrand" aria-label="ShipOS home">SHIP<span>OS</span><small>LOCAL BETA</small></a><nav aria-label="Main pages"><button aria-current={page === 'telemetry' ? 'page' : undefined} onClick={() => setPage('telemetry')}>Telemetry</button><button aria-current={page === 'story' ? 'page' : undefined} onClick={() => setPage('story')}>Storytelling <small>RP beta</small></button></nav><span className={`betaConnection ${status?.telemetry.connected ? 'live' : ''}`}>{status?.telemetry.connected ? 'Game connected' : 'Waiting / stale'}</span></header>
    {ready ? <>
      <div className="betaStatus"><span>{status?.worldName || ready.world.name}</span><span>{ready.session.role === 'editor' ? `Paired play screen · ${sync}` : sync}</span></div>
      {(!status?.telemetry.stableWorldIdentity || status.worldId !== ready.world.worldId) && <p className="betaNotice">{status?.worldId !== ready.world.worldId && status ? 'World changed. Reload to open its separate records.' : 'Waiting for stable world identity. Enable the bundled telemetry mod and reload your world. Until then, records belong to an unassigned local profile.'}</p>}
      {page === 'story' && <MissionStart viewer={false} />}
      <ShipOSPage readOnly={false} worldId={ready.world.worldId} experience={page === 'telemetry' ? 'navigation' : 'console'}
        configuration={<LocalSettings session={ready.session} status={status} refresh={refresh} />} />
    </> : <section className="betaMission"><h1>{error ? 'Let’s reconnect ShipOS' : 'Opening your local console…'}</h1><p>{error || 'Connecting to the helper on the gaming PC.'}</p>{error && <><p>On a tablet, generate a fresh pairing QR on the PC. On the PC, launch ShipOS from its shortcut.</p><button onClick={() => window.location.reload()}>Retry</button></>}</section>}
    <footer className="betaFooter">Free & open source · MIT · No accounts or subscriptions · Local game data only</footer>
    <BetaNotice />
  </>
}
