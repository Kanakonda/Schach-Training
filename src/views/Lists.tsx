import { useMemo, useRef, useState } from 'react'
import { CURATED, DB_INFO, FAMILIES, withSide } from '../data/catalog'
import Icon from '../Icon'
import { ENGINE_NAME } from '../lib/engine'
import { importPgn } from '../lib/pgn'
import type { Progress } from '../lib/srs'
import { createRepertoire, exportData, importData, learnedLines, useStore } from '../lib/store'
import type { Line, Opening, Side } from '../lib/types'

interface Tally {
  learned: number
  due: number
}

/** Zählt gelernte und fällige Linien je Eröffnung. */
function tally(progress: Record<string, Progress>): Map<string, Tally> {
  const now = Date.now()
  const map = new Map<string, Tally>()
  for (const [key, p] of Object.entries(progress)) {
    const id = key.slice(0, key.indexOf('/'))
    const t = map.get(id) ?? { learned: 0, due: 0 }
    t.learned++
    if (p.due <= now) t.due++
    map.set(id, t)
  }
  return map
}

interface CardProps {
  o: Opening
  t: Tally | undefined
  note?: string
  onOpen: () => void
}

function OpeningCard({ o, t, note, onOpen }: CardProps) {
  const learned = t?.learned ?? 0
  return (
    <li className="card">
      <button className="card-main" onClick={onOpen}>
        <span className="card-title">
          {o.name}
          {t && t.due > 0 && <span className="pill due">{t.due} fällig</span>}
        </span>
        <span className="card-sub">
          {[o.intl, `${o.lines.length} ${o.lines.length === 1 ? 'Linie' : 'Linien'}`, learned ? `${learned} gelernt` : '']
            .filter(Boolean)
            .join(' · ')}
        </span>
        {note && <span className="card-note">{note}</span>}
        {learned > 0 && (
          <span className="meter"><i style={{ width: `${Math.min(100, (learned / o.lines.length) * 100)}%` }} /></span>
        )}
      </button>
    </li>
  )
}

export function OpeningsView({ onOpen }: { onOpen: (id: string, filter?: string) => void }) {
  const { progress, sides } = useStore()
  const [query, setQuery] = useState('')
  const [all, setAll] = useState(false)
  const tallies = useMemo(() => tally(progress), [progress])
  const q = query.trim().toLowerCase()

  const card = (base: Opening, hits = 0) => {
    const o = withSide(base, sides[base.id] ?? base.side)
    return (
      <OpeningCard
        key={base.id}
        o={o}
        t={tallies.get(o.id)}
        note={hits ? `${hits} passende ${hits === 1 ? 'Variante' : 'Varianten'}` : undefined}
        onOpen={() => onOpen(base.id, hits ? query.trim() : undefined)}
      />
    )
  }

  const results = useMemo(() => {
    if (!q) return []
    return [...CURATED, ...FAMILIES]
      .map((o) => {
        const head = `${o.name} ${o.intl ?? ''} ${o.eco ?? ''}`.toLowerCase().includes(q)
        return { o, head, hits: head ? 0 : o.lines.filter((l) => l.name.toLowerCase().includes(q)).length }
      })
      .filter((r) => r.head || r.hits)
      .sort((a, b) => Number(b.head) - Number(a.head) || b.hits - a.hits)
  }, [q])

  return (
    <div className="view">
      <h1>Eröffnungen</h1>
      <p className="lead">
        {DB_INFO.count.toLocaleString('de-DE')} Linien aus {CURATED.length + FAMILIES.length} Eröffnungen. Erst ansehen, dann selbst spielen.
      </p>
      <label className="search">
        <Icon name="search" size={18} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Eröffnung oder Variante suchen" />
      </label>

      {q ? (
        <>
          <h2>{results.length} Treffer</h2>
          <ul className="list">{results.map((r) => card(r.o, r.hits))}</ul>
          {results.length === 0 && <p className="muted">Nichts gefunden. Die Varianten tragen ihre internationalen (englischen) Namen.</p>}
        </>
      ) : (
        <>
          {(['w', 'b'] as Side[]).map((side) => (
            <section key={side}>
              <h2>Grundkurse mit {side === 'w' ? 'Weiß' : 'Schwarz'}</h2>
              <ul className="list">{CURATED.filter((o) => o.side === side).map((o) => card(o))}</ul>
            </section>
          ))}
          <h2>Weitere Eröffnungen</h2>
          <ul className="list">{(all ? FAMILIES : FAMILIES.slice(0, 8)).map((o) => card(o))}</ul>
          {!all && (
            <button className="more" onClick={() => setAll(true)}>
              Alle {FAMILIES.length} Eröffnungen anzeigen
            </button>
          )}
        </>
      )}
    </div>
  )
}

export function RepertoireView({ onOpen }: { onOpen: (id: string) => void }) {
  const { custom, progress } = useStore()
  const tallies = useMemo(() => tally(progress), [progress])
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
      {custom.length === 0 && (
        <p className="lead">Lege eigene Repertoires an oder importiere sie als PGN, zum Beispiel aus einer Lichess-Studie.</p>
      )}
      <ul className="list">
        {custom.map((o) => (
          <OpeningCard key={o.id} o={o} t={tallies.get(o.id)} onOpen={() => onOpen(o.id)} />
        ))}
      </ul>

      <h2>Neues Repertoire</h2>
      <div className="stack">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (z. B. Mein Sizilianer)" />
        <div className="segmented" role="group" aria-label="Deine Farbe">
          <button className={side === 'w' ? 'on' : ''} onClick={() => setSide('w')}>Ich spiele Weiß</button>
          <button className={side === 'b' ? 'on' : ''} onClick={() => setSide('b')}>Ich spiele Schwarz</button>
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
  const learned = useMemo(() => learnedLines(s).sort((a, b) => a.progress.due - b.progress.due), [s])
  const due = learned.filter((i) => i.progress.due <= now)
  const next = learned.find((i) => i.progress.due > now)

  return (
    <div className="view">
      <h1>Training</h1>
      <div className="hero">
        <span className="hero-num">{due.length}</span>
        <span>{due.length === 1 ? 'Linie ist' : 'Linien sind'} fällig</span>
      </div>
      <div className="stack">
        <button className="primary" disabled={!due.length} onClick={() => onStart(due.slice(0, 20))}>
          Wiederholung starten
        </button>
        {learned.length > 0 && (
          <button onClick={() => onStart([...learned].sort(() => Math.random() - 0.5).slice(0, 10))}>
            Freies Training mit zufälligen Linien
          </button>
        )}
      </div>
      {learned.length === 0 && (
        <p className="lead">Lerne zuerst eine Linie unter „Eröffnungen“. Danach taucht sie hier zur Wiederholung auf.</p>
      )}
      {due.length === 0 && next && (
        <p className="muted">
          Alles erledigt. Nächste Wiederholung:{' '}
          {new Date(next.progress.due).toLocaleString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
      <p className="muted">
        Fehlerfreie Linien kommen in immer größeren Abständen wieder (1, 3, 8 … Tage), Linien mit Fehlern schon nach wenigen Minuten.
      </p>
    </div>
  )
}

export function StatsView() {
  const s = useStore()
  const now = Date.now()
  const rows = useMemo(() => {
    const map = new Map<string, { o: Opening; learned: number; due: number; correct: number; wrong: number }>()
    for (const { opening, progress } of learnedLines(s)) {
      const r = map.get(opening.id) ?? { o: opening, learned: 0, due: 0, correct: 0, wrong: 0 }
      r.learned++
      if (progress.due <= now) r.due++
      r.correct += progress.correct
      r.wrong += progress.wrong
      map.set(opening.id, r)
    }
    return [...map.values()].sort((a, b) => b.learned - a.learned)
  }, [s])
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0)
  const acc = (c: number, w: number) => (c + w ? `${Math.round((c / (c + w)) * 100)} %` : '–')

  return (
    <div className="view">
      <h1>Statistik</h1>
      <div className="tiles">
        <div><b>{sum((r) => r.learned)}</b><span>{sum((r) => r.learned) === 1 ? 'Linie' : 'Linien'} gelernt</span></div>
        <div><b>{sum((r) => r.due)}</b><span>fällig</span></div>
        <div><b>{acc(sum((r) => r.correct), sum((r) => r.wrong))}</b><span>Trefferquote</span></div>
      </div>
      <h2>Nach Eröffnung</h2>
      <ul className="list">
        {rows.map((r) => (
          <li key={r.o.id} className="card pad">
            <span className="card-title">
              {r.o.name}
              <span className="pill">{acc(r.correct, r.wrong)}</span>
            </span>
            <span className="card-sub">
              {r.o.custom ? '' : `mit ${r.o.side === 'w' ? 'Weiß' : 'Schwarz'} · `}
              {r.learned} von {r.o.lines.length} Linien gelernt · {r.due} fällig
            </span>
            <span className="meter"><i style={{ width: `${Math.min(100, (r.learned / r.o.lines.length) * 100)}%` }} /></span>
          </li>
        ))}
      </ul>
      {rows.length === 0 && <p className="lead">Noch keine Daten. Sobald du Linien spielst, siehst du hier deinen Fortschritt.</p>}

      <h2>Quellen und Lizenzen</h2>
      <p className="muted">
        Eröffnungsdaten: {DB_INFO.count.toLocaleString('de-DE')} Linien aus{' '}
        <a href="https://github.com/lichess-org/chess-openings" target="_blank" rel="noreferrer">lichess-org/chess-openings</a> (CC0).
        Kurze Linien sind mit Stockfish fortgesetzt und alle Schlussstellungen bewertet ({DB_INFO.engine}).
      </p>
      <p className="muted">
        Analyse: {ENGINE_NAME} als{' '}
        <a href="https://github.com/nmrugg/stockfish.js" target="_blank" rel="noreferrer">Stockfish.js</a>, lizenziert unter der{' '}
        <a href="engine/COPYING.txt" target="_blank" rel="noreferrer">GNU GPL v3</a>. Die Engine rechnet auf deinem Gerät.
      </p>
    </div>
  )
}
