import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { ShipOSPage } from './ShipOSPage'

type BridgeHealth = {
  lanTelemetryEndpoints?: unknown
}

function IpadSharePanel() {
  const [visible, setVisible] = useState(() => new URLSearchParams(window.location.search).get('share') === 'ipad')
  const [shareUrl, setShareUrl] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!visible) return
    let cancelled = false

    async function prepareShareLink() {
      try {
        const response = await fetch('/shipos-bridge/health', { cache: 'no-store' })
        if (!response.ok) throw new Error(`Telemetry helper returned HTTP ${response.status}.`)
        const health = await response.json() as BridgeHealth
        const endpoints = Array.isArray(health.lanTelemetryEndpoints)
          ? health.lanTelemetryEndpoints.filter((value): value is string => typeof value === 'string')
          : []
        if (!endpoints.length) throw new Error('No private-network address is available yet.')

        const telemetryEndpoint = new URL(endpoints[0])
        const url = new URL(window.location.href)
        url.protocol = telemetryEndpoint.protocol
        url.hostname = telemetryEndpoint.hostname
        url.port = window.location.port || '5174'
        url.pathname = '/'
        url.search = ''
        url.hash = ''
        const nextShareUrl = url.toString()
        const nextQrCode = await QRCode.toDataURL(nextShareUrl, {
          errorCorrectionLevel: 'M',
          margin: 2,
          width: 360,
          color: {
            dark: '#07171d',
            light: '#f2fffccc',
          },
        })
        if (cancelled) return
        setShareUrl(nextShareUrl)
        setQrCode(nextQrCode)
        setError('')
      } catch (caught) {
        if (cancelled) return
        setError(caught instanceof Error ? caught.message : 'Could not prepare the iPad link.')
      }
    }

    void prepareShareLink()
    return () => {
      cancelled = true
    }
  }, [visible])

  const close = () => {
    const url = new URL(window.location.href)
    url.searchParams.delete('share')
    window.history.replaceState({}, '', url)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="shipOsShareBackdrop" role="presentation">
      <section className="shipOsSharePanel" role="dialog" aria-modal="true" aria-labelledby="shipos-ipad-title">
        <button className="shipOsShareClose" type="button" onClick={close} aria-label="Close iPad connection code">×</button>
        <span className="shipOsShareEyebrow">Local network link</span>
        <h2 id="shipos-ipad-title">Open ShipOS on your iPad</h2>
        <p>Connect the iPad to the same Wi-Fi network, then scan this code with its Camera app.</p>
        {qrCode && <img className="shipOsShareQr" src={qrCode} alt={`QR code for ${shareUrl}`} />}
        {shareUrl && <code className="shipOsShareUrl">{shareUrl}</code>}
        {!qrCode && !error && <div className="shipOsSharePending">Preparing private link…</div>}
        {error && <div className="shipOsShareError" role="alert">{error}</div>}
        <small>The link works only while ShipOS is running on this PC. Telemetry stays on your local network.</small>
      </section>
    </div>
  )
}

export function App() {
  return (
    <>
      <ShipOSPage
        experience="navigation"
        accessToken=""
        isSignedIn={false}
        canUseRelay={false}
        accountName="Local operator"
        accountMode="Standalone"
        onSignIn={() => undefined}
        onSignOut={() => undefined}
        onBack={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      />
      <IpadSharePanel />
    </>
  )
}
