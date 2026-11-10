import { Chess } from 'chess.js'
import { useMemo, useState } from 'react'
import Board from '../Board'
import { formatMoves, german } from '../lib/pgn'
import { dueLabel } from '../lib/srs'
import { addLine, deleteLine, deleteRepertoire, lineKey, useStore } from '../lib/store'
import type { Line, Opening } from '../lib/types'

interface Props {
  opening: Opening
  onBack: () => void
  onStart: (lines: Line[], start: 'watch' | 'play') => void
}

export default function OpeningDetail({ opening, onBack, onStart }: Props) {
  const { progress } = useStore()
  const [editing, setEditing] = useState(false)
  const fresh = opening.lines.filter((l) => !progress[lineKey(opening, l)])
  const learned = opening.lines.length - fresh.length

  if (editing) return <LineEditor opening={opening} onClose={() => setEditing(false)} />

  return (
    <div className="view">
      <header className="bar">
        <button className="icon" onClick={onBack} aria-label="Zurück">←</button>
        <div className="bar-title">
          <strong>{opening.name}</strong>
          <span>
            Du spielst {opening.side === 'w' ? 'Weiß' : 'Schwarz'}
            {opening.eco ? ` · ${opening.eco}` : ''}
          </span>
        </div>
      </header>

      {opening.description && <p className="lead">{opening.description}</p>}

      {opening.lines.length > 0 && (
        <div className="stack">
          {fresh.length > 0 && (
            <button className="primary" onClick={() => onStart(fresh, 'watch')}>
              {learned === 0 ? 'Eröffnung lernen' : 'Weiterlernen'} ({fresh.length} neue {fresh.length === 1 ? 'Linie' : 'Linien'})
            </button>
          )}
          {learned > 0 && (
            <button onClick={() => onStart(opening.lines.filter((l) => progress[lineKey(opening, l)]), 'play')}>
              Gelernte Linien abfragen ({learned})
            </button>
          )}
        </div>
      )}

      <h2>Linien</h2>
      {opening.lines.length === 0 && <p className="muted">Noch keine Linien. Füge unten deine erste hinzu.</p>}
      <ul className="list">
        {opening.lines.map((l) => {
          const p = progress[lineKey(opening, l)]
          const label = dueLabel(p)
          return (
            <li key={l.id} className="card">
              <button className="card-main" onClick={() => onStart([l], p ? 'play' : 'watch')}>
                <span className="card-title">
                  {l.name}
                  <span className={'pill ' + (label === 'neu' ? 'new' : label === 'fällig' ? 'due' : 'ok')}>{label}</span>
                </span>
                <span className="card-sub">{formatMoves(l.moves)}</span>
              </button>
              <div className="card-actions">
                <button onClick={() => onStart([l], 'watch')}>👀 Ansehen</button>
                <button onClick={() => onStart([l], 'play')}>▶ Spielen</button>
                {opening.custom && (
                  <button
                    className="danger"
                    onClick={() => confirm(`„${l.name}“ löschen?`) && deleteLine(opening.id, l.id)}
                  >
                    Löschen
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {opening.custom && (
        <div className="stack">
          <button onClick={() => setEditing(true)}>＋ Linie auf dem Brett eingeben</button>
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

function LineEditor({ opening, onClose }: { opening: Opening; onClose: () => void }) {
  const [moves, setMoves] = useState<string[]>([])
  const [name, setName] = useState('')
  const { fen, last } = useMemo(() => {
    const chess = new Chess()
    let last: { from: string; to: string } | undefined
    for (const m of moves) last = chess.move(m)
    return { fen: chess.fen(), last }
  }, [moves])

  function onMove(from: string, to: string): boolean {
    try {
      const mv = new Chess(fen).move({ from, to, promotion: 'q' })
      setMoves([...moves, mv.san])
      return true
    } catch {
      return false
    }
  }

  return (
    <div className="trainer">
      <header className="bar">
        <button className="icon" onClick={onClose} aria-label="Abbrechen">✕</button>
        <div className="bar-title">
          <strong>Neue Linie</strong>
          <span>{opening.name}</span>
        </div>
      </header>
      <Board fen={fen} orientation={opening.side} interactive onMove={onMove} lastMove={last} />
      <div className="moves">
        {moves.length === 0 && <span className="muted">Spiele die Züge für beide Seiten auf dem Brett.</span>}
        {moves.map((m, i) => (
          <span key={i} className="mv">
            {i % 2 === 0 && <em>{i / 2 + 1}.</em>}
            {german(m)}
          </span>
        ))}
      </div>
      <section className="panel">
        <div className="controls">
          <button onClick={() => setMoves(moves.slice(0, -1))} disabled={!moves.length}>↩ Zug zurück</button>
          <button onClick={() => setMoves([])} disabled={!moves.length}>Neu beginnen</button>
        </div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name der Linie (z. B. Hauptlinie)" />
        <button
          className="primary"
          disabled={moves.length < 2}
          onClick={() => {
            addLine(opening.id, name.trim() || `Linie ${opening.lines.length + 1}`, moves)
            onClose()
          }}
        >
          Linie speichern
        </button>
      </section>
    </div>
  )
}
