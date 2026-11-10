import { Chess } from 'chess.js'
import { useEffect, useMemo, useState } from 'react'
import Board from './Board'
import { EnginePanel, EngineToggle, EvalBar, useEngine } from './EnginePanel'
import Icon from './Icon'
import { german } from './lib/pgn'
import type { Side } from './lib/types'

interface Step {
  from: string
  to: string
  san: string
}

/** Spielt eine Zugfolge durch und liefert alle Stellungen und Züge. */
export function replay(moves: string[]): { fens: string[]; steps: Step[] } {
  const chess = new Chess()
  const fens = [chess.fen()]
  const steps: Step[] = []
  for (const m of moves) {
    const mv = chess.move(m)
    steps.push({ from: mv.from, to: mv.to, san: mv.san })
    fens.push(chess.fen())
  }
  return { fens, steps }
}

interface Props {
  title: string
  subtitle?: string
  initialMoves?: string[]
  /** Stellung, an der das Brett startet (Anzahl gespielter Halbzüge) */
  initialPly?: number
  orientation: Side
  onClose?: () => void
  /** Meldet jede Änderung der Zugfolge, z. B. um sie zwischenzuspeichern */
  onChange?: (moves: string[]) => void
  /** Zeigt ein Formular, um die Zugfolge als Linie zu speichern */
  onSave?: (moves: string[], name: string) => void
  /** Platz für die Tab-Leiste freihalten */
  withTabs?: boolean
}

/** Freies Brett: beliebige Züge für beide Seiten, mit Stockfish-Analyse. */
export default function AnalysisBoard(props: Props) {
  const { title, subtitle, initialMoves = [], orientation, onClose, onChange, onSave, withTabs } = props
  const [moves, setMoves] = useState(initialMoves)
  const [ply, setPly] = useState(props.initialPly ?? initialMoves.length)
  const [side, setSide] = useState<Side>(orientation)
  const [name, setName] = useState('')
  const { fens, steps } = useMemo(() => replay(moves), [moves])
  const fen = fens[ply]
  const engine = useEngine(fen)

  useEffect(() => onChange?.(moves), [moves])

  function play(from: string, to: string, promotion = 'q'): boolean {
    try {
      const san = new Chess(fen).move({ from, to, promotion }).san
      if (moves[ply] !== san) setMoves([...moves.slice(0, ply), san])
      setPly(ply + 1)
      return true
    } catch {
      return false
    }
  }

  return (
    <div className={'trainer' + (withTabs ? ' with-tabs' : '')}>
      <header className="bar">
        {onClose && (
          <button className="icon" onClick={onClose} aria-label="Schließen">
            <Icon name="close" />
          </button>
        )}
        <div className="bar-title">
          <strong>{title}</strong>
          {subtitle && <span>{subtitle}</span>}
        </div>
        <button className="icon" onClick={() => setSide(side === 'w' ? 'b' : 'w')} aria-label="Brett drehen">
          <Icon name="flip" />
        </button>
      </header>

      <Board
        fen={fen}
        orientation={side}
        interactive
        onMove={play}
        lastMove={ply > 0 ? steps[ply - 1] : undefined}
        arrows={engine.arrows}
        side={engine.on ? <EvalBar pv={engine.top} orientation={side} /> : undefined}
      />

      <div className="moves" aria-label="Zugfolge">
        {moves.length === 0 && <span className="muted">Ziehe die Figuren, um eine Stellung zu untersuchen.</span>}
        {steps.map((s, i) => (
          <button key={i} className={'mv' + (i === ply - 1 ? ' cur' : '')} onClick={() => setPly(i + 1)}>
            {i % 2 === 0 && <em>{i / 2 + 1}.</em>}
            {german(s.san)}
          </button>
        ))}
      </div>

      <section className="panel">
        <div className="controls">
          <button onClick={() => setPly(0)} disabled={ply === 0} aria-label="Zum Anfang"><Icon name="first" /></button>
          <button onClick={() => setPly(ply - 1)} disabled={ply === 0} aria-label="Zug zurück"><Icon name="prev" /></button>
          <button onClick={() => setPly(ply + 1)} disabled={ply >= moves.length} aria-label="Zug vor"><Icon name="next" /></button>
          <button onClick={() => setPly(moves.length)} disabled={ply >= moves.length} aria-label="Zum Ende"><Icon name="last" /></button>
        </div>
        <EngineToggle />
        <EnginePanel fen={fen} engine={engine} onPlay={(uci) => play(uci.slice(0, 2), uci.slice(2, 4), uci[4])} />
        <div className="controls">
          <button onClick={() => { setMoves(moves.slice(0, Math.max(0, ply - 1))); setPly(Math.max(0, ply - 1)) }} disabled={ply === 0}>
            <Icon name="undo" size={18} /> Zug löschen
          </button>
          <button onClick={() => { setMoves([]); setPly(0) }} disabled={!moves.length}>Neu beginnen</button>
        </div>
        {onSave && (
          <>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name der Linie (z. B. Hauptlinie)" />
            <button className="primary" disabled={moves.length < 2} onClick={() => onSave(moves, name.trim())}>
              Linie speichern
            </button>
          </>
        )}
      </section>
    </div>
  )
}
