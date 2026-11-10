import { useEffect, useState, useSyncExternalStore } from 'react'

export const ENGINE_NAME = 'Stockfish 19'
const ENGINE_FILE = 'engine/stockfish-19-lite-single.js'
const MULTI_PV = 3
const GO = 'go depth 22 movetime 12000'

export interface PvLine {
  /** Bewertung in Hundertstel Bauern aus Sicht von Weiß */
  cp?: number
  /** Matt in n Zügen; positiv = Weiß setzt matt */
  mate?: number
  /** Züge in UCI-Schreibweise, z. B. „e2e4“ */
  moves: string[]
}

export interface Analysis {
  fen: string
  depth: number
  lines: PvLine[]
  done: boolean
}

export type EngineStatus = 'idle' | 'loading' | 'ready' | 'error'

/** Liest eine „info“-Zeile der Engine. `turn` ist die Seite am Zug in der analysierten Stellung. */
export function parseInfo(line: string, turn: 'w' | 'b'): { depth: number; index: number; pv: PvLine } | null {
  if (!line.startsWith('info ') || /\b(lowerbound|upperbound)\b/.test(line)) return null
  const depth = line.match(/\bdepth (\d+)/)
  const score = line.match(/\bscore (cp|mate) (-?\d+)/)
  const pv = line.match(/ pv (.+)$/)
  if (!depth || !score || !pv) return null
  const sign = turn === 'w' ? 1 : -1
  const value = Number(score[2]) * sign
  return {
    depth: Number(depth[1]),
    index: Number(line.match(/\bmultipv (\d+)/)?.[1] ?? 1) - 1,
    pv: { [score[1] as 'cp' | 'mate']: value, moves: pv[1].trim().split(/\s+/) },
  }
}

/** Anteil des Bewertungsbalkens für Weiß in Prozent */
export function whiteShare(pv: PvLine | undefined): number {
  if (!pv) return 50
  if (pv.mate !== undefined) return pv.mate > 0 ? 100 : 0
  const cp = pv.cp ?? 0
  return 50 + 50 * (2 / (1 + Math.exp(-0.0037 * cp)) - 1)
}

export function formatScore(pv: PvLine | undefined): string {
  if (!pv) return '–'
  if (pv.mate !== undefined) return `${pv.mate < 0 ? '−' : ''}#${Math.abs(pv.mate)}`
  return formatCp(pv.cp ?? 0)
}

export function formatCp(cp: number): string {
  if (Math.abs(cp) >= 10000) return cp > 0 ? '#' : '−#'
  const v = (Math.abs(cp) / 100).toFixed(1).replace('.', ',')
  if (v === '0,0') return v
  return cp > 0 ? `+${v}` : `−${v}`
}

type Listener = (a: Analysis) => void
interface Job {
  fen: string
  listener: Listener | null
}

class Engine {
  private worker: Worker | null = null
  private ready = false
  private searching = false
  private current: (Job & Analysis) | null = null
  private queued: Job | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private status: EngineStatus = 'idle'
  private statusListeners = new Set<() => void>()

  getStatus = () => this.status
  subscribe = (l: () => void) => {
    this.statusListeners.add(l)
    return () => this.statusListeners.delete(l)
  }

  private setStatus(s: EngineStatus) {
    this.status = s
    this.statusListeners.forEach((l) => l())
  }

  private boot() {
    this.setStatus('loading')
    try {
      this.worker = new Worker(import.meta.env.BASE_URL + ENGINE_FILE)
    } catch {
      return this.setStatus('error')
    }
    this.worker.onmessage = (e) => this.onLine(String(e.data))
    this.worker.onerror = () => {
      this.worker?.terminate()
      this.worker = null
      this.ready = this.searching = false
      this.setStatus('error')
    }
    this.worker.postMessage('uci')
  }

  private onLine(line: string) {
    if (line === 'uciok') {
      this.worker!.postMessage(`setoption name MultiPV value ${MULTI_PV}`)
      this.worker!.postMessage('isready')
    } else if (line === 'readyok' && !this.ready) {
      this.ready = true
      this.setStatus('ready')
      this.next()
    } else if (line.startsWith('bestmove')) {
      this.searching = false
      if (this.current) {
        this.current.done = true
        this.emit()
      }
      this.next()
    } else if (this.current?.listener) {
      const info = parseInfo(line, this.current.fen.split(' ')[1] as 'w' | 'b')
      if (!info) return
      // Eine neue Tiefe beginnt mit der ersten Variante: alte Varianten verwerfen
      if (info.index === 0 && info.depth !== this.current.depth) {
        this.current.depth = info.depth
        this.current.lines = this.current.lines.slice(0, 1)
      }
      this.current.lines[info.index] = info.pv
      if (!this.timer) this.timer = setTimeout(() => this.emit(), 80)
    }
  }

  private emit() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    const c = this.current
    c?.listener?.({ fen: c.fen, depth: c.depth, lines: c.lines.filter(Boolean), done: c.done })
  }

  private next() {
    if (!this.queued || !this.worker || !this.ready || this.searching) return
    this.current = { ...this.queued, depth: 0, lines: [], done: false }
    this.queued = null
    this.searching = true
    this.worker.postMessage(`position fen ${this.current.fen}`)
    this.worker.postMessage(GO)
  }

  /** Startet die Analyse einer Stellung; eine laufende Analyse wird abgebrochen. */
  analyse(fen: string, listener: Listener) {
    if (this.current) this.current.listener = null
    this.queued = { fen, listener }
    if (!this.worker) this.boot()
    else if (this.searching) this.worker.postMessage('stop')
    else this.next()
  }

  stop() {
    this.queued = null
    if (this.current) this.current.listener = null
    if (this.searching) this.worker?.postMessage('stop')
  }
}

const engine = new Engine()

/** Analysiert die Stellung, solange `fen` gesetzt ist. */
export function useAnalysis(fen: string | null): { status: EngineStatus; analysis: Analysis | null } {
  const status = useSyncExternalStore(engine.subscribe, engine.getStatus)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  useEffect(() => {
    if (!fen) return
    engine.analyse(fen, setAnalysis)
    return () => engine.stop()
  }, [fen])
  return { status, analysis: fen ? analysis : null }
}
