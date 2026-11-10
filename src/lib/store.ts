import { useSyncExternalStore } from 'react'
import { findOpening } from '../data/catalog'
import type { Progress } from './srs'
import type { Line, Opening, Side } from './types'

interface Settings {
  /** Stockfish-Analyse eingeschaltet */
  engine: boolean
}

interface State {
  custom: Opening[]
  progress: Record<string, Progress>
  /** Gewählte Farbe je Eröffnung, falls sie vom Standard abweicht */
  sides: Record<string, Side>
  settings: Settings
}

const KEY = 'schach-training-v1'
const listeners = new Set<() => void>()

function normalize(s: Partial<State> | null | undefined): State {
  return {
    custom: Array.isArray(s?.custom) ? s.custom : [],
    progress: s?.progress && typeof s.progress === 'object' ? s.progress : {},
    sides: s?.sides && typeof s.sides === 'object' ? s.sides : {},
    settings: { engine: false, ...s?.settings },
  }
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return normalize(JSON.parse(raw))
  } catch {
    /* defekte oder nicht verfügbare Daten: leer starten */
  }
  return normalize(null)
}

let state = load()

function set(next: State) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* Speicher voll oder gesperrt */
  }
  listeners.forEach((l) => l())
}

export function useStore(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

export const lineKey = (o: Opening, l: Line) => `${o.id}/${l.id}`

export interface Learned {
  key: string
  opening: Opening
  line: Line
  progress: Progress
}

const lineIndex = new WeakMap<Opening, Map<string, Line>>()

/** Alle Linien mit Lernstand, aufgelöst zu Eröffnung und Linie. */
export function learnedLines(s: Pick<State, 'custom' | 'progress'>): Learned[] {
  const out: Learned[] = []
  for (const [key, progress] of Object.entries(s.progress)) {
    const cut = key.indexOf('/')
    const opening = findOpening(s.custom, key.slice(0, cut))
    if (!opening) continue
    let index = lineIndex.get(opening)
    if (!index) lineIndex.set(opening, (index = new Map(opening.lines.map((l) => [l.id, l]))))
    const line = index.get(key.slice(cut + 1))
    if (line) out.push({ key, opening, line, progress })
  }
  return out
}

export function saveProgress(key: string, p: Progress) {
  set({ ...state, progress: { ...state.progress, [key]: p } })
}

export function setSide(openingId: string, side: Side) {
  set({ ...state, sides: { ...state.sides, [openingId]: side } })
}

export function setEngine(on: boolean) {
  set({ ...state, settings: { ...state.settings, engine: on } })
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

export function createRepertoire(name: string, side: Side, lines: Line[] = []): Opening {
  const o: Opening = { id: `c${uid()}`, name, side, lines, custom: true }
  set({ ...state, custom: [...state.custom, o] })
  return o
}

export function addLine(openingId: string, name: string, moves: string[]) {
  set({
    ...state,
    custom: state.custom.map((o) =>
      o.id === openingId ? { ...o, lines: [...o.lines, { id: `u${uid()}`, name, moves }] } : o,
    ),
  })
}

function dropProgress(prefix: string) {
  return Object.fromEntries(Object.entries(state.progress).filter(([k]) => !k.startsWith(prefix)))
}

export function deleteLine(openingId: string, lineId: string) {
  set({
    ...state,
    custom: state.custom.map((o) =>
      o.id === openingId ? { ...o, lines: o.lines.filter((l) => l.id !== lineId) } : o,
    ),
    progress: dropProgress(`${openingId}/${lineId}`),
  })
}

export function deleteRepertoire(openingId: string) {
  set({ ...state, custom: state.custom.filter((o) => o.id !== openingId), progress: dropProgress(`${openingId}/`) })
}

export function exportData(): string {
  return JSON.stringify(state, null, 2)
}

export function importData(json: string) {
  const s = JSON.parse(json)
  if (!s || !Array.isArray(s.custom) || typeof s.progress !== 'object') throw new Error('Ungültige Sicherung')
  set(normalize(s))
}
