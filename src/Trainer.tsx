import { Chess } from 'chess.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import AnalysisBoard, { replay } from './Analysis'
import Board from './Board'
import { EnginePanel, EngineToggle, EvalBar, useEngine } from './EnginePanel'
import Icon from './Icon'
import { formatCp } from './lib/engine'
import { german } from './lib/pgn'
import { dueLabel, gradeFor, review } from './lib/srs'
import { lineKey, saveProgress, useStore } from './lib/store'
import type { Line, Opening } from './lib/types'

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

const RESULT = {
  good: { title: 'Fehlerfrei', text: 'Die Linie sitzt.' },
  hard: { title: 'Fast', text: 'Noch etwas unsicher – die Linie kommt bald wieder.' },
  again: { title: 'Noch nicht sicher', text: 'Die Linie kommt in wenigen Minuten wieder.' },
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
  const [other, setOther] = useState<string | null>(null)
  const [wrong, setWrong] = useState<string>()
  const [analysing, setAnalysing] = useState(false)
  const saved = useRef(false)
  const engine = useEngine(fens[ply], phase === 'watch' && !analysing)

  // Vorführen: Züge automatisch abspielen
  useEffect(() => {
    if (phase !== 'watch' || !auto || analysing) return
    if (ply >= n) return setAuto(false)
    const t = setTimeout(() => setPly((p) => p + 1), ply === 0 ? 700 : 1100)
    return () => clearTimeout(t)
  }, [phase, auto, ply, n, analysing])

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
    setOther(null)
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
      setOther(null)
      setPly(ply + 1)
      return true
    }
    // Ein Zug, der in eine andere Variante derselben Eröffnung führt, ist kein Fehler
    let san = ''
    try {
      san = new Chess(fens[ply]).move({ from, to, promotion: 'q' }).san
    } catch {
      return false
    }
    const sibling = opening.lines.find(
      (l) => l !== line && l.moves[ply] === san && l.moves.slice(0, ply).every((m, i) => m === line.moves[i]),
    )
    if (sibling) {
      setOther(`${german(san)} gehört zur Variante „${sibling.name}“. Gesucht ist der Zug dieser Linie.`)
    } else {
      setOther(null)
      setMistakes((m) => m + 1)
      setAttempts((a) => a + 1)
    }
    setWrong(to)
    return false
  }

  function hint() {
    if (attempts < 2) setMistakes((m) => m + 1)
    setOther(null)
    setAttempts((a) => Math.max(2, a + 1))
  }

  if (analysing) {
    return (
      <AnalysisBoard
        title="Analyse"
        subtitle={`${opening.name} · ${line.name}`}
        initialMoves={line.moves}
        initialPly={phase === 'done' ? n : ply}
        orientation={opening.side}
        onClose={() => setAnalysing(false)}
      />
    )
  }

  const waiting = phase === 'play' && ply < n && userTurn(ply)
  const expected = waiting ? steps[ply] : undefined
  const shown = phase === 'watch' ? n : ply
  const grade = gradeFor(mistakes)
  const book = line.book ?? n
  const sideName = opening.side === 'w' ? 'Weiß' : 'Schwarz'

  let status = 'Der Gegner zieht …'
  if (waiting) {
    if (other) status = other
    else if (attempts === 0) status = 'Du bist am Zug.'
    else if (attempts === 1) status = 'Das ist nicht der Zug dieser Linie. Versuch es noch einmal.'
    else if (attempts === 2) status = 'Tipp: Die markierte Figur zieht.'
    else status = `Der richtige Zug ist ${german(steps[ply].san)}.`
  }

  return (
    <div className="trainer">
      <header className="bar">
        <button className="icon" onClick={onExit} aria-label="Schließen">
          <Icon name="close" />
        </button>
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
        arrows={expected && attempts >= 3 ? [expected] : phase === 'watch' ? engine.arrows : []}
        wrongSquare={wrong}
        side={engine.on ? <EvalBar pv={engine.top} orientation={opening.side} /> : undefined}
      />

      <div className="moves" aria-label="Zugfolge">
        {steps.slice(0, shown).map((s, i) => (
          <span key={i} className={'mv' + (i === ply - 1 ? ' cur' : '') + (userTurn(i) ? ' mine' : '') + (i >= book ? ' eng' : '')}>
            {i % 2 === 0 && <em>{i / 2 + 1}.</em>}
            {german(s.san)}
          </span>
        ))}
        {phase === 'play' && ply === 0 && <span className="muted">Die Zugfolge erscheint beim Spielen.</span>}
      </div>

      {phase === 'watch' && (
        <section className="panel">
          <p className="status">Linie ansehen – du spielst {sideName}.</p>
          {line.idea && <p className="idea">{line.idea}</p>}
          {!line.idea && line.eval !== undefined && (
            <p className="muted">
              {book < n
                ? `Datenbank bis Zug ${Math.ceil(book / 2)}, danach die Fortsetzung von Stockfish (gepunktet). `
                : ''}
              Bewertung der Schlussstellung: {formatCp(line.eval)}
            </p>
          )}
          <div className="controls">
            <button onClick={() => { setAuto(false); setPly(0) }} disabled={ply === 0} aria-label="Zum Anfang"><Icon name="first" /></button>
            <button onClick={() => { setAuto(false); setPly(Math.max(0, ply - 1)) }} disabled={ply === 0} aria-label="Zug zurück"><Icon name="prev" /></button>
            <button onClick={() => setAuto(!auto && ply < n)} disabled={ply >= n} aria-label={auto ? 'Anhalten' : 'Abspielen'}>
              <Icon name={auto ? 'pause' : 'play'} />
            </button>
            <button onClick={() => { setAuto(false); setPly(Math.min(n, ply + 1)) }} disabled={ply >= n} aria-label="Zug vor"><Icon name="next" /></button>
          </div>
          <button className="primary" onClick={startPlay}>Jetzt selbst spielen</button>
          <EngineToggle />
          <EnginePanel fen={fens[ply]} engine={engine} />
          <button onClick={() => { setAuto(false); setAnalysing(true) }}>
            <Icon name="engine" size={18} /> Stellung frei analysieren
          </button>
        </section>
      )}

      {phase === 'play' && (
        <section className="panel">
          <p className={'status' + (waiting && !other && attempts === 1 ? ' bad' : '')}>{status}</p>
          <div className="controls">
            <button onClick={hint} disabled={!waiting || attempts >= 3}><Icon name="hint" size={18} /> Tipp</button>
            <button onClick={startWatch}><Icon name="eye" size={18} /> Ansehen</button>
          </div>
          <p className="muted">Fehler: {mistakes}</p>
        </section>
      )}

      {phase === 'done' && (
        <section className="panel">
          <p className={'status big ' + grade}>{RESULT[grade].title}</p>
          <p className="muted">
            {mistakes} Fehler bei {userMoves} eigenen Zügen. {RESULT[grade].text}
            {grade !== 'again' && ` Nächste Wiederholung: ${dueLabel(progress)}.`}
          </p>
          {line.idea && <p className="idea">{line.idea}</p>}
          <div className="controls">
            <button onClick={startPlay}>Nochmal</button>
            <button onClick={startWatch}><Icon name="eye" size={18} /> Ansehen</button>
            <button onClick={() => setAnalysing(true)}><Icon name="engine" size={18} /> Analyse</button>
          </div>
          <button className="primary" onClick={hasNext ? onNext : onExit}>
            {hasNext ? 'Nächste Linie' : 'Fertig'}
          </button>
        </section>
      )}
    </div>
  )
}
