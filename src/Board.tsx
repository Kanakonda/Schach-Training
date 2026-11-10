import { Chess, type Square } from 'chess.js'
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Chessboard } from 'react-chessboard'
import type { Side } from './lib/types'

export interface BoardArrow {
  from: string
  to: string
  color?: string
}

export interface BoardProps {
  fen: string
  orientation: Side
  interactive?: boolean
  /** Gibt true zurück, wenn der Zug angenommen wurde. */
  onMove?: (from: string, to: string) => boolean
  lastMove?: { from: string; to: string }
  hintSquare?: string
  wrongSquare?: string
  arrows?: BoardArrow[]
  /** Element links neben dem Brett, z. B. der Bewertungsbalken */
  side?: ReactNode
}

const LAST: CSSProperties = { background: 'rgba(235, 200, 90, 0.42)' }
const SELECTED: CSSProperties = { background: 'rgba(90, 160, 240, 0.55)' }
const HINT: CSSProperties = { boxShadow: 'inset 0 0 0 4px #5a9ff0' }
const WRONG: CSSProperties = { background: 'rgba(225, 80, 75, 0.72)' }
const DOT: CSSProperties = {
  backgroundImage: 'radial-gradient(circle, rgba(14,17,22,0.34) 22%, transparent 24%)',
}
const CAPTURE: CSSProperties = {
  backgroundImage: 'radial-gradient(circle, transparent 62%, rgba(14,17,22,0.34) 64%)',
}

export default function Board(props: BoardProps) {
  const { fen, orientation, interactive = false, onMove, lastMove, hintSquare, wrongSquare, arrows, side } = props
  const [selected, setSelected] = useState<string | null>(null)
  useEffect(() => setSelected(null), [fen, interactive])

  const chess = useMemo(() => new Chess(fen), [fen])
  const targets = useMemo(
    () => (selected && interactive ? chess.moves({ square: selected as Square, verbose: true }) : []),
    [chess, selected, interactive],
  )

  const squareStyles: Record<string, CSSProperties> = {}
  if (lastMove) {
    squareStyles[lastMove.from] = LAST
    squareStyles[lastMove.to] = LAST
  }
  for (const t of targets) squareStyles[t.to] = { ...squareStyles[t.to], ...(chess.get(t.to) ? CAPTURE : DOT) }
  if (selected) squareStyles[selected] = SELECTED
  if (hintSquare) squareStyles[hintSquare] = { ...squareStyles[hintSquare], ...HINT }
  if (wrongSquare) squareStyles[wrongSquare] = WRONG

  function click(square: string) {
    if (!interactive) return
    if (selected && targets.some((t) => t.to === square)) {
      setSelected(null)
      onMove?.(selected, square)
      return
    }
    const piece = chess.get(square as Square)
    setSelected(piece && piece.color === chess.turn() && square !== selected ? square : null)
  }

  return (
    <div className="board-row">
      {side}
      <div className="board">
        <Chessboard
          options={{
            position: fen,
            boardOrientation: orientation === 'w' ? 'white' : 'black',
            allowDragging: interactive,
            allowDrawingArrows: false,
            animationDurationInMs: 200,
            squareStyles,
            arrows: (arrows ?? []).map((a) => ({ startSquare: a.from, endSquare: a.to, color: a.color ?? '#5a9ff0' })),
            darkSquareStyle: { backgroundColor: '#58826a' },
            lightSquareStyle: { backgroundColor: '#e6e1d3' },
            boardStyle: { borderRadius: 6, overflow: 'hidden' },
            onSquareClick: ({ square }) => click(square),
            onPieceDrop: ({ sourceSquare, targetSquare }) => {
              if (!interactive || !targetSquare || sourceSquare === targetSquare) return false
              return onMove?.(sourceSquare, targetSquare) ?? false
            },
          }}
        />
      </div>
    </div>
  )
}
