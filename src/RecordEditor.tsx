import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

export function RecordEditor<T extends { id: string }>({ title, records, setRecords, template, choices = {} }: {
  title: string; records: T[]; setRecords: Dispatch<SetStateAction<T[]>>; template: T
  choices?: Partial<Record<keyof T, string[]>>
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<T>(template)
  const [error, setError] = useState('')
  const choose = (record: T) => { setDraft(structuredClone(record)); setEditing(record.id); setError('') }
  return <details className="shipOsPanel shipOsRecordEditor"><summary>{title} · {records.length} records</summary>
    <p className="betaMuted">Player-authored RP records. These do not change the game.</p>
    <div className="betaActions">{records.map(record => <button key={record.id} onClick={() => choose(record)}>{String(('name' in record && record.name) || ('title' in record && record.title) || ('item' in record && record.item) || ('version' in record && record.version) || record.id)}</button>)}<button onClick={() => { setEditing(null); setDraft(structuredClone(template)); setError('') }}>New record</button></div>
    <form onSubmit={event => {
      event.preventDefault()
      const values = Object.entries(draft).filter(([key]) => key !== 'id')
      if (!values.some(([,value]) => typeof value === 'string' && value.trim())) { setError('Enter a name or description first.'); return }
      if (values.some(([,value]) => typeof value === 'number' && !Number.isFinite(value))) { setError('Numbers must be finite.'); return }
      const next = { ...draft, id: editing || `record-${Date.now()}-${Math.random().toString(36).slice(2,8)}` }
      setRecords(current => editing ? current.map(record => record.id === editing ? next : record) : [...current, next])
      setEditing(null); setDraft(structuredClone(template)); setError('')
    }}>
      <div className="betaRecordFields">{Object.entries(template).filter(([key]) => key !== 'id').map(([key, value]) => {
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())
        const current = draft[key as keyof T]
        const options = choices[key as keyof T]
        const update = (raw: string) => setDraft(previous => ({ ...previous, [key]: Array.isArray(value) ? raw.split('\n').map(v => v.trim()).filter(Boolean) : typeof value === 'number' ? Number(raw) : raw }))
        return <label key={key}>{label}{options ? <select value={String(current)} onChange={event => update(event.target.value)}>{options.map(option => <option key={option}>{option}</option>)}</select> : Array.isArray(value) || /notes|capabilities|change|reason|outcome/i.test(key) ? <textarea value={Array.isArray(current) ? current.join('\n') : String(current ?? '')} onChange={event => update(event.target.value)} placeholder={Array.isArray(value) ? 'One entry per line' : ''} maxLength={8000} /> : <input type={typeof value === 'number' ? 'number' : 'text'} step="any" value={String(current ?? '')} onChange={event => update(event.target.value)} maxLength={500} />}</label>
      })}</div>
      {error && <p role="alert">{error}</p>}
      <div className="betaActions"><button type="submit">{editing ? 'Save record' : 'Add record'}</button>{editing && <button type="button" onClick={() => { if (!window.confirm('Delete this story record?')) return; setRecords(current => current.filter(record => record.id !== editing)); setEditing(null); setDraft(structuredClone(template)) }}>Delete record</button>}</div>
    </form>
  </details>
}
