import { ShipOSPage } from './ShipOSPage'

export function App() {
  return (
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
  )
}
