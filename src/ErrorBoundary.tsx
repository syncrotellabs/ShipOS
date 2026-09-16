import { Component } from 'react'
import type { ReactNode } from 'react'
import { downloadRecovery } from './localState'
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return <section className="betaMission" role="alert"><h1>ShipOS needs to reconnect</h1><p>The beta could not render this view. Your saved database has not been reset. Download any unsaved draft before reloading. If this keeps happening, check the helper logs and your browser’s WebGL support.</p><div className="betaActions"><button onClick={downloadRecovery}>Download unsaved draft</button><button onClick={() => location.reload()}>Reload ShipOS</button></div></section>
  }
}
