import { useRef, useState } from 'react'
import { OPENINGS } from '../data/openings'
import { importPgn } from '../lib/pgn'
import { allOpenings, createRepertoire, exportData, importData, lineKey, useStore } from '../lib/store'
import type { Line, Opening, Side } from '../lib/types'

function OpeningCard({ o, onOpen }: { o: Opening; onOpen: (id: string) => void }) {
  const { progress } = useStore()
  const now = Date.now()
  const states = o.lines.map((l) => progress[lineKey(o, l)])
  const learned = states.filter(Boolean).length
  const due = states.filter((p) => p && p.due <= now).length
  return (
    <li className="card">
      <button className="card-main" onClick={() => onOpen(o.id)}>
        <span className="card-title">
          {o.name}
          {due > 0 && <span className="pill due">{due} fällig</span>}
        </span>
        <span className="card-sub">
          {o.lines.length} {o.lines.length === 1 ? 'Linie' : 'Linien'} · {learned} gelernt
        </span>
        <span className="meter"><i style={{ width: `${o.lines.length ? (learned / o.lines.length) * 100 : 0}%` }} /></span>
      </button>
    </li>
  )
}

export function OpeningsView({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <div className="view">
      <h1>Eröffnungen</h1>
      <p className="lead">Wähle eine Eröffnung: erst ansehen, dann selbst gegen den Gegner spielen.</p>
      {(['w', 'b'] as Side[]).map((side) => (
        <section key={side}>
          <h2>{side === 'w' ? '♔ Mit Weiß' : '♚ Mit Schwarz'}</h2>
          <ul className="list">
            {OPENINGS.filter((o) => o.side === side).map((o) => (
              <OpeningCard key={o.id} o={o} onOpen={onOpen} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

export function RepertoireView({ onOpen }: { onOpen: (id: string) => void }) {
  const { custom } = useStore()
  const [name, setName] = useState('')
  const [side, setSide] = useState<Side>('w')
  const [pgn, setPgn] = useState('')
  const [msg, setMsg] = useState('')
  const pgnFile = useRef<HTMLInputElement>(null)
  const backupFile = useRef<HTMLInputElement>(null)

  function create(lines: Line[] = []) {
    const o = createRepertoire(name.trim() || 'Mein Repertoire', side, lines)
    setName('')
    return o
  }

  function doImport() {
    const r = importPgn(pgn)
    if (!r.lines.length) return setMsg('Keine gültigen Zugfolgen im PGN gefunden.')
    const o = create(r.lines)
    setPgn('')
    setMsg(`${r.lines.length} Linien importiert${r.skipped ? `, ${r.skipped} übersprungen` : ''}.`)
    onOpen(o.id)
  }

  return (
    <div className="view">
      <h1>Mein Repertoire</h1>
      {custom.length === 0 && <p className="lead">Lege eigene Repertoires an oder importiere sie als PGN (z. B. aus einer Lichess-Studie).</p>}
      <ul className="list">
        {custom.map((o) => (
          <OpeningCard key={o.id} o={o} onOpen={onOpen} />
        ))}
      </ul>

      <h2>Neues Repertoire</h2>
      <div className="stack">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (z. B. Mein Sizilianer)" />
        <div className="segmented" role="group" aria-label="Deine Farbe">
          <button className={side === 'w' ? 'on' : ''} onClick={() => setSide('w')}>♔ Ich spiele Weiß</button>
          <button className={side === 'b' ? 'on' : ''} onClick={() => setSide('b')}>♚ Ich spiele Schwarz</button>
        </div>
        <button className="primary" onClick={() => onOpen(create().id)}>Leeres Repertoire anlegen</button>
      </div>

      <h2>PGN importieren</h2>
      <div className="stack">
        <textarea value={pgn} onChange={(e) => setPgn(e.target.value)} rows={5} placeholder={'1. e4 e5 2. Nf3 Nc6 (2... d6 3. d4) 3. Bc4 …'} />
        <div className="controls">
          <button onClick={() => pgnFile.current?.click()}>Datei wählen</button>
          <button className="primary" disabled={!pgn.trim()} onClick={doImport}>Importieren</button>
        </div>
        <input
          ref={pgnFile}
          type="file"
          accept=".pgn,text/plain"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (f) setPgn(await f.text())
            e.target.value = ''
          }}
        />
        <p className="muted">Name und Farbe von oben werden übernommen. Varianten in Klammern werden zu eigenen Linien.</p>
        {msg && <p className="status">{msg}</p>}
      </div>

      <h2>Sicherung</h2>
      <div className="controls">
        <button
          onClick={() => {
            const a = document.createElement('a')
            a.href = URL.createObjectURL(new Blob([exportData()], { type: 'application/json' }))
            a.download = 'schach-training-sicherung.json'
            a.click()
            URL.revokeObjectURL(a.href)
          }}
        >
          Exportieren
        </button>
        <button onClick={() => backupFile.current?.click()}>Wiederherstellen</button>
        <input
          ref={backupFile}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f || !confirm('Aktuelle Repertoires und Fortschritte durch die Sicherung ersetzen?')) return
            try {
              importData(await f.text())
              setMsg('Sicherung wiederhergestellt.')
            } catch {
              setMsg('Die Datei ist keine gültige Sicherung.')
            }
          }}
        />
      </div>
      <p className="muted">Alle Daten liegen nur auf diesem Gerät. Mit einer Sicherung überträgst du sie auf ein anderes.</p>
    </div>
  )
}

export interface Item {
  opening: Opening
  line: Line
}

export function TrainView({ onStart }: { onStart: (items: Item[]) => void }) {
  const s = useStore()
  const now = Date.now()
  const learned: (Item & { due: number })[] = []
  for (const o of allOpenings(s))
    for (const l of o.lines) {
      const p = s.progress[lineKey(o, l)]
      if (p) learned.push({ opening: o, line: l, due: p.due })
    }
  learned.sort((a, b) => a.due - b.due)
  const due = learned.filter((i) => i.due <= now)
  const next = learned.find((i) => i.due > now)

  return (
    <div className="view">
      <h1>Training</h1>
      <div className="hero">
        <span className="hero-num">{due.length}</span>
        <span>{due.length === 1 ? 'Linie ist' : 'Linien sind'} heute fällig</span>
      </div>
      <div className="stack">
        <button className="primary" disabled={!due.length} onClick={() => onStart(due)}>Wiederholung starten</button>
        {learned.length > 0 && (
          <button onClick={() => onStart([...learned].sort(() => Math.random() - 0.5).slice(0, 10))}>
            Freies Training (zufällige Linien)
          </button>
        )}
      </div>
      {learned.length === 0 && <p className="lead">Lerne zuerst eine Linie unter „Eröffnungen“ – danach taucht sie hier zur Wiederholung auf.</p>}
      {due.length === 0 && next && (
        <p className="muted">
          Alles erledigt 🎉 Nächste Wiederholung: {new Date(next.due).toLocaleString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
      <p className="muted">
        Fehlerfreie Linien kommen in immer größeren Abständen wieder (1, 3, 8 … Tage), Linien mit Fehlern schon bald.
      </p>
    </div>
  )
}

export function StatsView() {
  const s = useStore()
  const now = Date.now()
  const rows = allOpenings(s)
    .map((o) => {
      const ps = o.lines.map((l) => s.progress[lineKey(o, l)]).filter(Boolean)
      const correct = ps.reduce((a, p) => a + p.correct, 0)
      const wrong = ps.reduce((a, p) => a + p.wrong, 0)
      return { o, learned: ps.length, due: ps.filter((p) => p.due <= now).length, correct, wrong }
    })
  const total = rows.reduce((a, r) => a + r.o.lines.length, 0)
  const learned = rows.reduce((a, r) => a + r.learned, 0)
  const correct = rows.reduce((a, r) => a + r.correct, 0)
  const wrong = rows.reduce((a, r) => a + r.wrong, 0)
  const acc = (c: number, w: number) => (c + w ? `${Math.round((c / (c + w)) * 100)} %` : '–')

  return (
    <div className="view">
      <h1>Statistik</h1>
      <div className="tiles">
        <div><b>{learned}</b><span>von {total} Linien gelernt</span></div>
        <div><b>{rows.reduce((a, r) => a + r.due, 0)}</b><span>fällig</span></div>
        <div><b>{acc(correct, wrong)}</b><span>Trefferquote</span></div>
      </div>
      <h2>Nach Eröffnung</h2>
      <ul className="list">
        {rows.filter((r) => r.learned > 0).map((r) => (
          <li key={r.o.id} className="card pad">
            <span className="card-title">{r.o.name}<span className="pill">{acc(r.correct, r.wrong)}</span></span>
            <span className="card-sub">{r.learned} von {r.o.lines.length} Linien gelernt · {r.due} fällig</span>
            <span className="meter"><i style={{ width: `${(r.learned / r.o.lines.length) * 100}%` }} /></span>
          </li>
        ))}
      </ul>
      {learned === 0 && <p className="lead">Noch keine Daten – sobald du Linien spielst, siehst du hier deinen Fortschritt.</p>}
    </div>
  )
}
