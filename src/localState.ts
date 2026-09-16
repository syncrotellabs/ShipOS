import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

export type LocalSession = { role: 'admin' | 'editor'; worldId: string }
export type WorldState = { worldId: string; name: string; state: Record<string, unknown>; revision: number; updatedAt: string }
let saved: WorldState
let prefix = ''
const cache = new Map<string, string>()
const pending = new Map<string, unknown>()
let busy = false
let conflict = false
let serial = 0
let timer: number | undefined
const localKeys = new Set([
  'shipos-current-position', 'shipos-last-telemetry-packet', 'shipos-telemetry-history',
  'shipos-contact-memory', 'shipos-contact-memory-visible', 'shipos-bridge-config',
  'shipos-display-preferences', 'shipos-alarm-sound-uplink-enabled', 'shipos-contact-search',
  'shipos-contact-sort', 'shipos-contact-filters', 'shipos-body-scale-mode', 'shipos-echomail-folder', 'shipos-echomail-search',
  'shipos-planetary-chart-overrides',
])
const shared = (key: string) => key.startsWith('shipos-') && !key.startsWith('shipos-sync-') && !localKeys.has(key)
export const profileStorage = {
  get length() { return cache.size },
  key(index: number) { return [...cache.keys()][index] ?? null },
  getItem(key: string) { return cache.get(key) ?? null },
  setItem(key: string, value: string) {
    cache.set(key, value)
    try { window.localStorage.setItem(prefix + key, value) } catch { notify('Browser cache full. Shared story records are still saved on the PC.') }
  },
  removeItem(key: string) { cache.delete(key); window.localStorage.removeItem(prefix + key) },
}
const notify = (message: string) => window.dispatchEvent(new CustomEvent('shipos:sync-status', { detail: message }))
const hydrate = (keys?: string[]) => window.dispatchEvent(new CustomEvent('shipos:state-hydrated', { detail: { keys } }))

export async function localApi<T>(route: string, body?: unknown, method = 'POST'): Promise<T> {
  const response = await fetch(route, { cache: 'no-store', ...(body === undefined ? {} : {
    method, headers: { 'Content-Type': 'application/json', 'X-ShipOS-Client': 'local-beta' }, body: JSON.stringify(body),
  }) })
  const value = await response.json()
  if (!response.ok) throw Object.assign(new Error(value.error || `HTTP ${response.status}`), { status: response.status })
  return value as T
}

export function initializeLocalState(_nextSession: LocalSession, state: WorldState) {
  saved = state; prefix = `shipos-beta-v2:${state.worldId}:`
  cache.clear(); pending.clear(); conflict = false
  for (const key of localKeys) {
    // Never replay old telemetry as a live reading after a restart or world change.
    if (['shipos-last-telemetry-packet', 'shipos-current-position', 'shipos-telemetry-history', 'shipos-bridge-config'].includes(key)) continue
    const raw = window.localStorage.getItem(prefix + key)
    if (raw) cache.set(key, raw)
  }
  for (const [key, value] of Object.entries(state.state)) if (shared(key)) cache.set(key, JSON.stringify(value))
  if (timer) window.clearInterval(timer)
  timer = window.setInterval(() => void synchronize(), 1500)
}

function preserveDraft() {
  const draft = { format: 'shipos-local-backup-v1', ...saved, state: { ...saved.state, ...Object.fromEntries(pending) } }
  try { window.localStorage.setItem('shipos-beta-recovery', JSON.stringify(draft)) } catch { /* in-memory draft stays available */ }
  return draft
}
export function downloadRecovery() {
  const data = pending.size ? JSON.stringify(preserveDraft(), null, 2) : window.localStorage.getItem('shipos-beta-recovery')
  if (!data) return
  const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }))
  const a = document.createElement('a'); a.href = url; a.download = 'ShipOS-unsaved-draft.json'; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function synchronize() {
  if (!saved || busy || conflict) return
  busy = true
  try {
    if (pending.size) {
      const changes = new Map(pending)
      const state = { ...saved.state, ...Object.fromEntries(changes) }
      const result = await localApi<WorldState>('/api/state', { worldId: saved.worldId, expectedRevision: saved.revision, state }, 'PUT')
      saved = result
      for (const [key, value] of changes) if (JSON.stringify(pending.get(key)) === JSON.stringify(value)) pending.delete(key)
      notify(pending.size ? 'Saving local story…' : `Saved on this PC · revision ${saved.revision}`)
    } else {
      const before = serial
      const result = await localApi<WorldState>('/api/state')
      if (result.worldId !== saved.worldId) {
        if (pending.size) preserveDraft()
        conflict = true
        notify('The game world changed. Reload to open its separate story. Any unsaved draft is preserved.')
        return
      }
      if (result.revision !== saved.revision) {
        if (serial !== before || pending.size) throw Object.assign(new Error('Another console saved while you were editing.'), { status: 409 })
        const keys = new Set([...Object.keys(saved.state), ...Object.keys(result.state)])
        saved = result
        for (const key of keys) {
          if (key in result.state) profileStorage.setItem(key, JSON.stringify(result.state[key]))
          else profileStorage.removeItem(key)
        }
        hydrate([...keys])
      }
      notify(`Saved on this PC · revision ${saved.revision}`)
    }
  } catch (error) {
    const status = (error as { status?: number }).status
    if (status === 409 || status === 401 || status === 403) {
      conflict = true; preserveDraft()
      notify(`${(error as Error).message} Download your draft before reloading.`)
    } else notify(`Not saved yet — ${(error as Error).message} Retrying; keep this page open.`)
  } finally { busy = false }
}

window.addEventListener('beforeunload', event => {
  if (!pending.size) return
  preserveDraft(); event.preventDefault()
})

export function usePersistentState<T>(key: string, initialValue: T): readonly [T, Dispatch<SetStateAction<T>>] {
  const initial = useRef(initialValue)
  const read = () => {
    try { const raw = profileStorage.getItem(key); return raw ? JSON.parse(raw) as T : initial.current } catch { return initial.current }
  }
  const [value, setValue] = useState<T>(read)
  const current = useRef(value)
  current.current = value
  useEffect(() => {
    const listener = (event: Event) => {
      const keys = (event as CustomEvent<{ keys?: string[] }>).detail?.keys
      if (!keys || keys.includes(key)) {
        const next = read()
        if (JSON.stringify(current.current) !== JSON.stringify(next)) { current.current = next; setValue(next) }
      }
    }
    window.addEventListener('shipos:state-hydrated', listener)
    return () => window.removeEventListener('shipos:state-hydrated', listener)
  }, [key])
  const update = useCallback<Dispatch<SetStateAction<T>>>((action) => {
    const next = typeof action === 'function' ? (action as (value: T) => T)(current.current) : action
    if (JSON.stringify(next) === JSON.stringify(current.current)) return
    if (shared(key) && conflict) {
      notify('Editing paused. Download your draft and reload the saved story.')
      return
    }
    current.current = next; setValue(next)
    profileStorage.setItem(key, JSON.stringify(next))
    if (shared(key)) { pending.set(key, next); serial++; hydrate([key]); notify('Saving local story…') }
  }, [key])
  return [value, update] as const
}
