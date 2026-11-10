import { Chess, type Square } from 'chess.js'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Chessboard } from 'react-chessboard'
import type { Side } from './lib/types'

export interface BoardProps {
  fen: string
  orientation: Side
  interactive?: boolean
  /** Gibt true zurück, wenn der Zug angenommen wurde. */
  onMove?: (from: string, to: string) => boolean
  lastMove?: { from: string; to: string }
  hintSquare?: string
  wrongSquare?: string
  arrow?: { from: string; to: string }
}

const LAST: CSSProperties = { background: 'rgba(240, 200, 80, 0.45)' }
const SELECTED: CSSProperties = { background: 'rgba(90, 170, 255, 0.55)' }
const HINT: CSSProperties = { boxShadow: 'inset 0 0 0 4px #5aaaff' }
const WRONG: CSSProperties = { background: 'rgba(230, 70, 70, 0.7)' }
const DOT: CSSProperties = {
  backgroundImage: 'radial-gradient(circle, rgba(20,25,31,0.35) 22%, transparent 24%)',
}
const CAPTURE: CSSProperties = {
  backgroundImage: 'radial-gradient(circle, transparent 62%, rgba(20,25,31,0.35) 64%)',
}

export default function Board(props: BoardProps) {
  const { fen, orientation, interactive = false, onMove, lastMove, hintSquare, wrongSquare, arrow } = props
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
    <div className="board">
      <Chessboard
        options={{
          position: fen,
          boardOrientation: orientation === 'w' ? 'white' : 'black',
          allowDragging: interactive,
          allowDrawingArrows: false,
          animationDurationInMs: 220,
          squareStyles,
          arrows: arrow ? [{ startSquare: arrow.from, endSquare: arrow.to, color: '#5aaaff' }] : [],
          darkSquareStyle: { backgroundColor: '#4f8a6b' },
          lightSquareStyle: { backgroundColor: '#e9e2cf' },
          boardStyle: { borderRadius: 8, overflow: 'hidden' },
          onSquareClick: ({ square }) => click(square),
          onPieceDrop: ({ sourceSquare, targetSquare }) => {
            if (!interactive || !targetSquare || sourceSquare === targetSquare) return false
            return onMove?.(sourceSquare, targetSquare) ?? false
          },
        }}
      />
    </div>
  )
}
