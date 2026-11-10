import { Chess } from 'chess.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import Board from './Board'
import { german } from './lib/pgn'
import { dueLabel, gradeFor, review } from './lib/srs'
import { lineKey, saveProgress, useStore } from './lib/store'
import type { Line, Opening } from './lib/types'

interface Step {
  from: string
  to: string
  san: string
}

/** Spielt die Linie einmal durch und liefert alle Stellungen und Züge. */
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

type Phase = 'watch' | 'play' | 'done'

interface Props {
  opening: Opening
  line: Line
  /** 'watch': erst ansehen, dann spielen. 'play': direkt abfragen. */
  start: 'watch' | 'play'
  position: string
  hasNext: boolean
  onNext: () => void
  onExit: () => void
}

export default function Trainer({ opening, line, start, position, hasNext, onNext, onExit }: Props) {
  const { fens, steps } = useMemo(() => replay(line.moves), [line])
  const n = steps.length
  const userTurn = (ply: number) => (ply % 2 === 0) === (opening.side === 'w')
  const userMoves = steps.filter((_, i) => userTurn(i)).length
  const key = lineKey(opening, line)
  const progress = useStore().progress[key]

  const [phase, setPhase] = useState<Phase>(start)
  const [ply, setPly] = useState(0)
  const [auto, setAuto] = useState(start === 'watch')
  const [mistakes, setMistakes] = useState(0)
  const [attempts, setAttempts] = useState(0)
  const [wrong, setWrong] = useState<string>()
  const saved = useRef(false)

  // Vorführen: Züge automatisch abspielen
  useEffect(() => {
    if (phase !== 'watch' || !auto) return
    if (ply >= n) return setAuto(false)
    const t = setTimeout(() => setPly((p) => p + 1), ply === 0 ? 700 : 1100)
    return () => clearTimeout(t)
  }, [phase, auto, ply, n])

  // Abfragen: Gegner zieht automatisch, am Ende wird gespeichert
  useEffect(() => {
    if (phase !== 'play') return
    if (ply >= n) {
      if (!saved.current) {
        saved.current = true
        saveProgress(key, review(progress, mistakes, userMoves))
      }
      setPhase('done')
      return
    }
    if (userTurn(ply)) return
    const t = setTimeout(() => setPly((p) => p + 1), 550)
    return () => clearTimeout(t)
  }, [phase, ply, n])

  useEffect(() => {
    if (!wrong) return
    const t = setTimeout(() => setWrong(undefined), 500)
    return () => clearTimeout(t)
  }, [wrong])

  function startPlay() {
    saved.current = false
    setPhase('play')
    setPly(0)
    setAuto(false)
    setMistakes(0)
    setAttempts(0)
  }

  function startWatch() {
    setPhase('watch')
    setPly(0)
    setAuto(true)
  }

  function onMove(from: string, to: string): boolean {
    const expected = steps[ply]
    if (from === expected.from && to === expected.to) {
      setAttempts(0)
      setPly(ply + 1)
      return true
    }
    setMistakes((m) => m + 1)
    setAttempts((a) => a + 1)
    setWrong(to)
    return false
  }

  function hint() {
    if (attempts < 2) setMistakes((m) => m + 1)
    setAttempts((a) => Math.max(2, a + 1))
  }

  const waiting = phase === 'play' && ply < n && userTurn(ply)
  const expected = waiting ? steps[ply] : undefined
  const shown = phase === 'watch' ? n : ply
  const grade = gradeFor(mistakes)

  return (
    <div className="trainer">
      <header className="bar">
        <button className="icon" onClick={onExit} aria-label="Schließen">✕</button>
        <div className="bar-title">
          <strong>{opening.name}</strong>
          <span>{line.name}</span>
        </div>
        <span className="pill">{position}</span>
      </header>

      <Board
        fen={fens[ply]}
        orientation={opening.side}
        interactive={waiting}
        onMove={onMove}
        lastMove={ply > 0 ? steps[ply - 1] : undefined}
        hintSquare={expected && attempts >= 2 ? expected.from : undefined}
        arrow={expected && attempts >= 3 ? expected : undefined}
        wrongSquare={wrong}
      />

      <div className="moves" aria-label="Zugfolge">
        {steps.slice(0, shown).map((s, i) => (
          <span key={i} className={'mv' + (i === ply - 1 ? ' cur' : '') + (userTurn(i) ? ' mine' : '')}>
            {i % 2 === 0 && <em>{i / 2 + 1}.</em>}
            {german(s.san)}
          </span>
        ))}
        {phase === 'play' && ply === 0 && <span className="muted">Zugfolge erscheint beim Spielen</span>}
      </div>

      {phase === 'watch' && (
        <section className="panel">
          <p className="status">👀 Schau dir die Linie an – du spielst {opening.side === 'w' ? 'Weiß' : 'Schwarz'}.</p>
          {line.idea && <p className="idea">{line.idea}</p>}
          <div className="controls">
            <button onClick={() => { setAuto(false); setPly(0) }} disabled={ply === 0}>⏮</button>
            <button onClick={() => { setAuto(false); setPly(Math.max(0, ply - 1)) }} disabled={ply === 0}>◀</button>
            <button onClick={() => setAuto(!auto && ply < n)} disabled={ply >= n}>{auto ? '⏸' : '▶ Auto'}</button>
            <button onClick={() => { setAuto(false); setPly(Math.min(n, ply + 1)) }} disabled={ply >= n}>▶</button>
          </div>
          <button className="primary" onClick={startPlay}>Jetzt selbst spielen</button>
        </section>
      )}

      {phase === 'play' && (
        <section className="panel">
          <p className="status">
            {waiting
              ? attempts === 0
                ? 'Du bist am Zug – spiele den Repertoire-Zug.'
                : attempts === 1
                  ? '❌ Das ist nicht der Zug aus der Linie. Versuch es noch einmal.'
                  : attempts === 2
                    ? '💡 Diese Figur zieht.'
                    : `💡 Der richtige Zug ist ${german(steps[ply].san)}.`
              : 'Der Gegner zieht …'}
          </p>
          <div className="controls">
            <button onClick={hint} disabled={!waiting || attempts >= 3}>💡 Tipp</button>
            <button onClick={startWatch}>👀 Nochmal ansehen</button>
          </div>
          <p className="muted">Fehler: {mistakes}</p>
        </section>
      )}

      {phase === 'done' && (
        <section className="panel">
          <p className="status big">
            {grade === 'good' ? '🎉 Fehlerfrei!' : grade === 'hard' ? '👍 Fast – noch etwas wackelig.' : '🔁 Die Linie sitzt noch nicht.'}
          </p>
          <p className="muted">
            {mistakes} Fehler bei {userMoves} eigenen Zügen · nächste Wiederholung: {grade === 'again' ? 'in ca. 10 Minuten' : dueLabel(progress)}
          </p>
          {line.idea && <p className="idea">{line.idea}</p>}
          <div className="controls">
            <button onClick={startPlay}>Nochmal üben</button>
            <button onClick={startWatch}>👀 Ansehen</button>
          </div>
          <button className="primary" onClick={hasNext ? onNext : onExit}>
            {hasNext ? 'Nächste Linie' : 'Fertig'}
          </button>
        </section>
      )}
    </div>
  )
}
