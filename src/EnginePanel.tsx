import { Chess } from 'chess.js'
import { useMemo } from 'react'
import type { BoardArrow } from './Board'
import { ENGINE_NAME, formatScore, useAnalysis, whiteShare, type Analysis, type EngineStatus, type PvLine } from './lib/engine'
import { german } from './lib/pgn'
import { setEngine, useStore } from './lib/store'
import type { Side } from './lib/types'

export interface EngineState {
  on: boolean
  status: EngineStatus
  /** Analyse der aktuellen Stellung, sobald erste Ergebnisse da sind */
  analysis: Analysis | null
  /** Beste bekannte Variante; überbrückt den Wechsel zwischen zwei Stellungen */
  top: PvLine | undefined
  over: boolean
  arrows: BoardArrow[]
}

/** Analysiert die Stellung, wenn die Engine eingeschaltet und `active` gesetzt ist. */
export function useEngine(fen: string, active = true): EngineState {
  const on = useStore().settings.engine && active
  const end = useMemo(() => {
    const chess = new Chess(fen)
    if (!chess.isGameOver()) return null
    // Matt: der Balken zeigt voll für die Seite, die matt gesetzt hat
    return chess.isCheckmate() ? { mate: chess.turn() === 'w' ? -1 : 1, moves: [] } : { cp: 0, moves: [] }
  }, [fen])
  const over = end !== null
  const { status, analysis } = useAnalysis(on && !over ? fen : null)
  const current = analysis && analysis.fen === fen && analysis.lines.length ? analysis : null
  const best = current?.lines[0]?.moves[0]
  return {
    on,
    status,
    analysis: current,
    top: !on ? undefined : (end ?? analysis?.lines[0]),
    over,
    arrows: best ? [{ from: best.slice(0, 2), to: best.slice(2, 4), color: 'rgba(63, 174, 122, 0.85)' }] : [],
  }
}

export function EvalBar({ pv, orientation }: { pv: PvLine | undefined; orientation: Side }) {
  return (
    <div className={'evalbar' + (orientation === 'b' ? ' flipped' : '')} role="img" aria-label={`Bewertung ${formatScore(pv)}`}>
      <i style={{ height: `${whiteShare(pv)}%` }} />
    </div>
  )
}

/** Wandelt eine Engine-Variante in lesbare Züge um: „7. Lg5 e6 8. f4“ */
export function pvToSan(fen: string, moves: string[], max = 9): string {
  const chess = new Chess(fen)
  const out: string[] = []
  for (const uci of moves.slice(0, max)) {
    const number = chess.moveNumber()
    const white = chess.turn() === 'w'
    try {
      const m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
      out.push((white ? `${number}. ` : out.length === 0 ? `${number}… ` : '') + german(m.san))
    } catch {
      break
    }
  }
  return out.join(' ')
}

export function EngineToggle() {
  const on = useStore().settings.engine
  return (
    <button className="switch-row" role="switch" aria-checked={on} onClick={() => setEngine(!on)}>
      <span>Stockfish-Analyse</span>
      <span className={'switch' + (on ? ' on' : '')} />
    </button>
  )
}

interface PanelProps {
  fen: string
  engine: EngineState
  /** Wird aufgerufen, wenn eine Variante angetippt wird (erster Zug in UCI). */
  onPlay?: (uci: string) => void
}

export function EnginePanel({ fen, engine, onPlay }: PanelProps) {
  if (!engine.on) return null
  const { status, analysis, over } = engine
  let body
  if (over) {
    const chess = new Chess(fen)
    body = <p className="muted">{chess.isCheckmate() ? 'Schachmatt.' : 'Remis.'}</p>
  } else if (status === 'error') {
    body = <p className="muted">Stockfish konnte nicht geladen werden. Beim ersten Mal ist eine Internetverbindung nötig.</p>
  } else if (!analysis) {
    body = <p className="muted">{status === 'loading' ? 'Stockfish wird geladen …' : 'Stockfish rechnet …'}</p>
  } else {
    body = (
      <ol className="pv-list">
        {analysis.lines.map((pv, i) => {
          const good = pv.mate !== undefined ? pv.mate > 0 : (pv.cp ?? 0) >= 0
          const text = pvToSan(fen, pv.moves)
          return (
            <li key={i}>
              <button disabled={!onPlay} onClick={() => onPlay?.(pv.moves[0])}>
                <span className={'score ' + (good ? 'white' : 'black')}>{formatScore(pv)}</span>
                <span className="pv">{text}</span>
              </button>
            </li>
          )
        })}
      </ol>
    )
  }
  return (
    <div className="engine">
      <div className="engine-head">
        <span>{ENGINE_NAME}</span>
        {analysis && !over && <span>Tiefe {analysis.depth}</span>}
      </div>
      {body}
    </div>
  )
}
