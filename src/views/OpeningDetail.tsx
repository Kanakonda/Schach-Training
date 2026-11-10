import { useMemo, useState } from 'react'
import AnalysisBoard from '../Analysis'
import { groupsOf, labelIn, withSide } from '../data/catalog'
import Icon from '../Icon'
import { formatCp } from '../lib/engine'
import { formatMoves } from '../lib/pgn'
import { dueLabel } from '../lib/srs'
import { addLine, deleteLine, deleteRepertoire, lineKey, setSide, useStore } from '../lib/store'
import type { Line, Opening } from '../lib/types'

const BATCH = 5

interface Props {
  opening: Opening
  /** Vorbelegter Suchbegriff, wenn die Eröffnung über die Suche geöffnet wurde */
  initialFilter?: string
  onBack: () => void
  onStart: (opening: Opening, lines: Line[], start: 'watch' | 'play') => void
}

export default function OpeningDetail({ opening: base, initialFilter = '', onBack, onStart }: Props) {
  const { progress, sides } = useStore()
  const opening = base.custom ? base : withSide(base, sides[base.id] ?? base.side)
  const [editing, setEditing] = useState(false)
  const [filter, setFilter] = useState(initialFilter)
  const [open, setOpen] = useState<Set<string> | null>(null)
  const now = Date.now()

  const groups = useMemo(() => groupsOf(opening), [opening])
  const q = filter.trim().toLowerCase()
  const visible = useMemo(
    () =>
      groups
        .map((g) => ({
          ...g,
          lines: q
            ? g.lines.filter((l) => l.name.toLowerCase().includes(q) || formatMoves(l.moves).toLowerCase().includes(q))
            : g.lines,
        }))
        .filter((g) => g.lines.length),
    [groups, q],
  )
  const isOpen = (name: string, i: number) => (q ? true : open ? open.has(name) : i === 0)
  function toggle(name: string, i: number) {
    const next = new Set(open ?? (visible[0] ? [visible[0].name] : []))
    if (isOpen(name, i)) next.delete(name)
    else next.add(name)
    setOpen(next)
  }

  const state = (l: Line) => progress[lineKey(opening, l)]
  const fresh = opening.lines.filter((l) => !state(l))
  const learned = opening.lines.filter((l) => state(l))
  const due = learned.filter((l) => state(l).due <= now)

  if (editing) {
    return (
      <AnalysisBoard
        title="Neue Linie"
        subtitle={opening.name}
        orientation={opening.side}
        onClose={() => setEditing(false)}
        onSave={(moves, name) => {
          addLine(opening.id, name || `Linie ${opening.lines.length + 1}`, moves)
          setEditing(false)
        }}
      />
    )
  }

  function row(l: Line, group: string) {
    const p = state(l)
    const label = dueLabel(p)
    const mine = l.eval === undefined ? 0 : opening.side === 'w' ? l.eval : -l.eval
    return (
      <li key={l.id} className="line">
        <button className="line-main" onClick={() => onStart(opening, [l], p ? 'play' : 'watch')}>
          <span className="line-top">
            <span className="line-name">{labelIn(l, group)}</span>
            {l.eval !== undefined && (
              <span className={'eval' + (mine <= -100 ? ' bad' : mine >= 100 ? ' good' : '')}>{formatCp(l.eval)}</span>
            )}
            <span className={'pill ' + (label === 'neu' ? 'new' : label === 'fällig' ? 'due' : 'ok')}>{label}</span>
          </span>
          <span className="line-moves">{formatMoves(l.moves)}</span>
        </button>
        {opening.custom && (
          <button
            className="icon ghost danger"
            aria-label={`${l.name} löschen`}
            onClick={() => confirm(`„${l.name}“ löschen?`) && deleteLine(opening.id, l.id)}
          >
            <Icon name="trash" size={18} />
          </button>
        )}
      </li>
    )
  }

  return (
    <div className="view">
      <header className="bar">
        <button className="icon" onClick={onBack} aria-label="Zurück">
          <Icon name="back" />
        </button>
        <div className="bar-title">
          <strong>{opening.name}</strong>
          <span>{[opening.intl, opening.eco, `${opening.lines.length} Linien`].filter(Boolean).join(' · ')}</span>
        </div>
      </header>

      {opening.description && <p className="lead">{opening.description}</p>}

      {!opening.custom && (
        <div className="segmented" role="group" aria-label="Deine Farbe">
          <button className={opening.side === 'w' ? 'on' : ''} onClick={() => setSide(base.id, 'w')}>Ich spiele Weiß</button>
          <button className={opening.side === 'b' ? 'on' : ''} onClick={() => setSide(base.id, 'b')}>Ich spiele Schwarz</button>
        </div>
      )}

      {opening.lines.length > 0 && (
        <div className="stack actions">
          {fresh.length > 0 && (
            <button className="primary" onClick={() => onStart(opening, fresh.slice(0, BATCH), 'watch')}>
              {fresh.length === 1 ? 'Neue Linie lernen' : `Nächste ${Math.min(BATCH, fresh.length)} Linien lernen`}
            </button>
          )}
          {due.length > 0 && (
            <button onClick={() => onStart(opening, due, 'play')}>Fällige Linien wiederholen ({due.length})</button>
          )}
          {learned.length > 0 && (
            <button onClick={() => onStart(opening, learned.slice(0, 20), 'play')}>Gelernte Linien abfragen ({learned.length})</button>
          )}
        </div>
      )}

      <div className="section-head">
        <h2>Linien</h2>
        <span className="muted">{learned.length} von {opening.lines.length} gelernt</span>
      </div>

      {opening.lines.length > 8 && (
        <label className="search">
          <Icon name="search" size={18} />
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Variante oder Zug suchen" />
        </label>
      )}

      {opening.lines.length === 0 && <p className="muted">Noch keine Linien. Füge unten deine erste hinzu.</p>}
      {q && visible.length === 0 && <p className="muted">Keine Variante gefunden.</p>}

      {visible.map((g, i) =>
        g.name === '' ? (
          <ul key="all" className="lines card">{g.lines.map((l) => row(l, ''))}</ul>
        ) : (
          <section key={g.name} className="card group">
            <button className="group-head" aria-expanded={isOpen(g.name, i)} onClick={() => toggle(g.name, i)}>
              <span className="group-name">{g.name}</span>
              <span className="muted">
                {g.lines.filter((l) => state(l)).length}/{g.lines.length}
              </span>
              <Icon name={isOpen(g.name, i) ? 'down' : 'right'} size={18} />
            </button>
            {isOpen(g.name, i) && <ul className="lines">{g.lines.map((l) => row(l, g.name))}</ul>}
          </section>
        ),
      )}

      {!opening.custom && (
        <p className="muted footnote">
          Die Zahl neben einer Linie ist die Stockfish-Bewertung der Schlussstellung aus Sicht von Weiß. Varianten aus der
          Datenbank tragen ihre internationalen (englischen) Namen.
        </p>
      )}

      {opening.custom && (
        <div className="stack actions">
          <button onClick={() => setEditing(true)}><Icon name="plus" size={18} /> Linie auf dem Brett eingeben</button>
          <button
            className="danger"
            onClick={() => {
              if (confirm(`Repertoire „${opening.name}“ mit allen Linien löschen?`)) {
                deleteRepertoire(opening.id)
                onBack()
              }
            }}
          >
            Repertoire löschen
          </button>
        </div>
      )}
    </div>
  )
}
