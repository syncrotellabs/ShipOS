import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { ShipOSPage } from './ShipOSPage'
import { downloadRecovery, initializeLocalState, localApi, synchronize, usePersistentState } from './localState'
import type { LocalSession, WorldState } from './localState'

type Status = {
  version: string; worldId: string; worldName: string; dataDir?: string
  telemetry: { connected: boolean; stamp: string | null; error: string; stableWorldIdentity: boolean; watchFile?: string }
  sharing: { enabled: boolean; url: string | null; address: string | null; addresses?: string[] }
  ai: { enabled: boolean; model: string; host: string }
  gameChat: { enabled: boolean; proactiveMinutes: number; available: boolean; lastRequestAt: string | null; lastReplyAt: string | null; nextProactiveAt: string | number | null; error: string }
  gameBridge: { connected: boolean; deviceId: string | null }
  relay: { enabled: boolean; configured: boolean; connected: boolean; url: string; lastSuccessAt: string | null; error: string }
}
type Device = { id: string; label: string; role: 'editor' }
type BridgeDevice = { id: string; label: string; createdAt: string; lastSeenAt: string | null }
type NewBridge = BridgeDevice & { token: string; bridgeUrl: string }
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

export function BetaNotice() {
  const dialog = useRef<HTMLDialogElement>(null)
  const [accepted, setAccepted] = useState(() => localStorage.getItem('shipos-beta-notice-v2') === 'accepted')
  useEffect(() => { if (!accepted && dialog.current && !dialog.current.open) dialog.current.showModal() }, [accepted])
  if (accepted) return null
  return <dialog className="betaDialog" ref={dialog} aria-labelledby="beta-title" onCancel={event => event.preventDefault()}>
    <span className="betaEyebrow">Welcome aboard · 0.2 beta</span>
    <h2 id="beta-title">Your game. Your story.<br />Still a work in progress.</h2>
    <p>ShipOS is a free, open-source companion for local, single-player Space Engineers.</p>
    <p><strong>Storytelling and AI roleplay are especially experimental.</strong> Fictional messages, missions, accounts, and advice are not live game facts. ShipOS does not control your game.</p>
    <p>Your records stay on the gaming PC by default. Optional tablet sharing works on your trusted local network; an explicitly enabled Echoboard relay can send game telemetry and GPS coordinates over HTTPS for remote viewing. Optional AI can run on this PC or another computer on your private network.</p>
    <p className="betaMuted">Back up important stories. If telemetry goes stale, the screen shows the last known reading.</p>
    <button autoFocus className="betaPrimary" onClick={() => { localStorage.setItem('shipos-beta-notice-v2', 'accepted'); dialog.current?.close(); setAccepted(true) }}>Got it — let’s play</button>
  </dialog>
}

export function MissionStart({ viewer }: { viewer: boolean }) {
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
  const [bridgeDevices, setBridgeDevices] = useState<BridgeDevice[]>([])
  const [bridgeLabel, setBridgeLabel] = useState('Space Engineers PC')
  const [newBridge, setNewBridge] = useState<NewBridge | null>(null)
  const [model, setModel] = useState(status?.ai.model || '')
  const [aiHost, setAiHost] = useState(status?.ai.host || '127.0.0.1')
  const [gameChatEnabled, setGameChatEnabled] = useState(Boolean(status?.gameChat.enabled))
  const [proactiveMinutes, setProactiveMinutes] = useState(status?.gameChat.proactiveMinutes || 0)
  const [relayToken, setRelayToken] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [resetText, setResetText] = useState('')
  const [now, setNow] = useState(Date.now())
  const admin = session.role === 'admin'
  const refreshAdminDevices = async () => {
    const [paired, bridges] = await Promise.all([
      localApi<Device[]>('/api/admin/devices'),
      localApi<BridgeDevice[]>('/api/admin/bridge-devices'),
    ])
    setDevices(paired); setBridgeDevices(bridges)
  }
  useEffect(() => {
    if (admin) void refreshAdminDevices().catch(() => undefined)
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [admin])
  useEffect(() => { setModel(status?.ai.model || '') }, [status?.ai.model])
  useEffect(() => { setAiHost(status?.ai.host || '127.0.0.1') }, [status?.ai.host])
  useEffect(() => { setGameChatEnabled(Boolean(status?.gameChat.enabled)); setProactiveMinutes(status?.gameChat.proactiveMinutes || 0) }, [status?.gameChat.enabled, status?.gameChat.proactiveMinutes])
  const act = async (fn: () => Promise<void>) => {
    setBusy(true); setMessage('')
    try { await fn(); await refresh(); if (admin) await refreshAdminDevices() }
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
    <section className="betaSettingsSection"><h3>Optional private-network AI</h3><p>Ollama can run on this gaming PC or another computer on the same trusted private network. ShipOS accepts only <code>127.0.0.1</code> or a private IPv4 address and always uses port <code>11434</code>; public hosts and arbitrary URLs are rejected.</p>
      <label>AI computer IPv4 address<input value={aiHost} onChange={event => setAiHost(event.target.value)} placeholder="127.0.0.1 or 192.168.1.50" inputMode="decimal" maxLength={15} /></label>
      <label>Installed Ollama model name<input value={model} onChange={event => setModel(event.target.value)} placeholder="Exact model name installed on the AI computer" maxLength={160} /></label>
      <div className="betaActions"><button disabled={busy || !model.trim() || !aiHost.trim()} onClick={() => void act(async () => { await localApi('/api/admin/ai', { model: model.trim(), host: aiHost.trim(), enabled: true }); setMessage('Private-network AI enabled. Switch to Storytelling to use it.'); window.dispatchEvent(new Event('shipos:ai-settings')) })}>Enable AI computer</button><button disabled={busy} onClick={() => void act(async () => { await localApi('/api/admin/ai', { model: model.trim(), host: aiHost.trim() || '127.0.0.1', enabled: false }); window.dispatchEvent(new Event('shipos:ai-settings')) })}>Disable AI</button></div>
      <p className="betaMuted">Remote prompts travel as unencrypted HTTP inside your LAN. Restrict Ollama and TCP 11434 to the trusted Private network—never port-forward it.</p>
    </section>
    <section className="betaSettingsSection"><h3>Remote gaming-PC bridge</h3>
      <p>Run Space Engineers on another Windows computer while ShipOS and Ollama stay here. The bundled collector sends telemetry to this app and carries ShipOS chat replies back to the game over your trusted private network.</p>
      <p><strong>The bridge can exchange telemetry and local ShipOS chat text only.</strong> Its key does not grant story, settings, block control, inventory, save, or hosted-relay access.</p>
      <label>Gaming PC label<input value={bridgeLabel} onChange={event => setBridgeLabel(event.target.value)} maxLength={80} placeholder="Space Engineers PC" /></label>
      <div className="betaActions"><button disabled={busy || !status?.sharing.enabled || !bridgeLabel.trim()} onClick={() => void act(async () => {
        const created = await localApi<NewBridge>('/api/admin/bridge-devices', { label: bridgeLabel.trim() })
        setNewBridge(created); setMessage('Game-PC bridge created. Copy the command now; the key will not be shown again.')
      })}>Create game-PC bridge</button></div>
      {!status?.sharing.enabled && <p className="betaMuted">Enable local sharing above before creating a bridge.</p>}
      {newBridge && <div className="betaQr"><p><strong>Copy this now — the bridge key is shown once.</strong> Run from the cloned ShipOS repository on the Windows gaming PC with Node.js 24:</p><label>PowerShell command<textarea readOnly rows={4} value={`node .\\runtime\\game-bridge.mjs --url "${newBridge.bridgeUrl}" --token "${newBridge.token}"`} onFocus={event => event.currentTarget.select()} /></label><button disabled={busy} onClick={() => void navigator.clipboard.writeText(`node .\\runtime\\game-bridge.mjs --url "${newBridge.bridgeUrl}" --token "${newBridge.token}"`).then(() => setMessage('Gaming-PC bridge command copied.')).catch(() => setMessage('Automatic copy was blocked. Select the command above and copy it manually.'))}>Copy bridge command</button><p className="betaMuted">Treat this key like a password. This LAN link uses HTTP; never port-forward TCP 5174.</p></div>}
      <p className="betaMuted">Status: {status?.gameBridge.connected ? 'Gaming PC connected' : 'Waiting for gaming PC'}.</p>
      {bridgeDevices.map(device => <div className="betaDevice" key={device.id}><span>{device.label}</span><b>{device.id === status?.gameBridge.deviceId && status.gameBridge.connected ? 'Connected' : device.lastSeenAt ? `Last seen ${new Date(device.lastSeenAt).toLocaleString()}` : 'Never connected'}</b><button onClick={() => void act(async () => { await localApi('/api/admin/bridge-devices', { id: device.id, revoke: true }); if (newBridge?.id === device.id) setNewBridge(null) })}>Revoke</button></div>)}
    </section>
    <section className="betaSettingsSection"><h3>In-game ShipOS comms</h3>
      <p>Opt in to a local chat bridge between the bundled Space Engineers mod and your configured Ollama model. In game, type <code>/shipos status</code>, <code>/shipos &lt;message&gt;</code>, or <code>@ShipOS &lt;message&gt;</code>. Replies appear as ShipOS chat messages.</p>
      <p><strong>This channel can read the current telemetry context and write text into local game chat only.</strong> It cannot steer, trigger blocks, move inventory, edit the save, or receive commands through the hosted relay.</p>
      <label>Proactive telemetry updates<select value={proactiveMinutes} onChange={event => setProactiveMinutes(Number(event.target.value))}><option value={0}>Off — reply only</option><option value={10}>At most every 10 minutes</option><option value={20}>At most every 20 minutes</option><option value={30}>At most every 30 minutes</option></select></label>
      <div className="betaActions"><button disabled={busy || !status?.ai.enabled || !status?.gameChat.available} onClick={() => void act(async () => {
        await localApi('/api/admin/game-chat', { enabled: true, proactiveMinutes }); setGameChatEnabled(true); setMessage('In-game ShipOS comms enabled. Reload the world after installing this mod update, then type /shipos status in game.')
      })}>{gameChatEnabled ? 'Update in-game comms' : 'Enable in-game comms'}</button><button disabled={busy || !gameChatEnabled} onClick={() => void act(async () => {
        await localApi('/api/admin/game-chat', { enabled: false, proactiveMinutes: 0 }); setGameChatEnabled(false); setMessage('In-game ShipOS comms disabled.')
      })}>Disable in-game comms</button></div>
      <p className="betaMuted">Status: {gameChatEnabled ? 'Enabled' : 'Off'}{status?.gameChat.error ? ` · ${status.gameChat.error}` : ''}{status?.gameChat.lastReplyAt ? ` · last reply ${new Date(status.gameChat.lastReplyAt).toLocaleString()}` : ''}.</p>
    </section>
    <section className="betaSettingsSection"><h3>Optional Echoboard telemetry relay</h3>
      <p>Send live Space Engineers telemetry to <code>shipos.echoboardhq.com</code> over outbound HTTPS so a WordPress-authenticated browser on another computer can view it. No inbound port or home-network forwarding is required.</p>
      <p><strong>This includes ship position, status, contacts, and saved GPS coordinates.</strong> Story records and Ollama prompts are not included. The relay cannot send commands to the game.</p>
      <label>One-time relay key from the hosted administrator page<input type="password" autoComplete="off" value={relayToken} onChange={event => setRelayToken(event.target.value)} placeholder="shipos_relay_…" maxLength={80} /></label>
      <div className="betaActions"><button disabled={busy || status?.relay.enabled || !relayToken.trim()} onClick={() => void act(async () => {
        await localApi('/api/admin/relay', { enabled: true, token: relayToken.trim() }); setRelayToken(''); setMessage('Secure telemetry relay enabled. The next game packet will be uploaded.')
      })}>Enable secure relay</button><button disabled={busy || !status?.relay.enabled} onClick={() => void act(async () => {
        await localApi('/api/admin/relay', { enabled: false }); setRelayToken(''); setMessage('Telemetry relay disabled and its local key was erased.')
      })}>Disable &amp; forget key</button></div>
      <p className="betaMuted">Status: {status?.relay.connected ? 'Connected' : status?.relay.enabled ? status.relay.error || 'Waiting for the hosted service' : 'Off'}{status?.relay.lastSuccessAt ? ` · last upload ${new Date(status.relay.lastSuccessAt).toLocaleString()}` : ''}. Relay keys are created and revoked by a WordPress administrator at {status?.relay.url || 'https://shipos.echoboardhq.com'}.</p>
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
  const refresh = async () => { setStatus(await localApi<Status>('/api/status')) }
  useEffect(() => {
    let cancelled = false
    void boot().then(result => { if (!cancelled) { setReady(result); void refresh().catch(() => undefined) } }).catch(error => { if (!cancelled) setError(error.message) })
    const timer = window.setInterval(() => { if (!cancelled) void refresh().catch(() => setStatus(current => current ? { ...current, telemetry: { ...current.telemetry, connected: false } } : current)) }, 3000)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [])
  return <>
    <header className="betaHeader"><a href="/" className="betaBrand" aria-label="ShipOS home">SHIP<span>OS</span><small>LOCAL BETA</small></a><nav aria-label="Main pages"><button aria-current={page === 'telemetry' ? 'page' : undefined} onClick={() => setPage('telemetry')}>Telemetry</button><button aria-current={page === 'story' ? 'page' : undefined} onClick={() => setPage('story')}>Storytelling <small>RP beta</small></button></nav><span className={`betaConnection ${status?.telemetry.connected ? 'live' : ''}`}>{status?.telemetry.connected ? 'Game connected' : 'Waiting / stale'}</span></header>
    {ready ? <>
      <div className="betaStatus"><span>{status?.worldName || ready.world.name}</span><span>{ready.session.role === 'editor' ? 'Paired play screen' : 'Gaming PC console'}</span></div>
      {(!status?.telemetry.stableWorldIdentity || status.worldId !== ready.world.worldId) && <p className="betaNotice">{status?.worldId !== ready.world.worldId && status ? 'World changed. Reload to open its separate records.' : 'Waiting for stable world identity. Enable the bundled telemetry mod and reload your world. Until then, records belong to an unassigned local profile.'}</p>}
      {page === 'story' && <MissionStart viewer={false} />}
      <ShipOSPage readOnly={false} worldId={ready.world.worldId} experience={page === 'telemetry' ? 'navigation' : 'console'}
        configuration={<LocalSettings session={ready.session} status={status} refresh={refresh} />} />
    </> : <section className="betaMission"><h1>{error ? 'Let’s reconnect ShipOS' : 'Opening your local console…'}</h1><p>{error || 'Connecting to the helper on the gaming PC.'}</p>{error && <><p>On a tablet, generate a fresh pairing QR on the PC. On the PC, launch ShipOS from its shortcut.</p><button onClick={() => window.location.reload()}>Retry</button></>}</section>}
    <footer className="betaFooter">Free & open source · MIT · No subscriptions · Local-first with optional secure telemetry relay</footer>
    <BetaNotice />
  </>
}
