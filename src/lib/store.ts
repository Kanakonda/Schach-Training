import { useSyncExternalStore } from 'react'
import { OPENINGS } from '../data/openings'
import type { Progress } from './srs'
import type { Line, Opening, Side } from './types'

interface State {
  custom: Opening[]
  progress: Record<string, Progress>
}

const KEY = 'schach-training-v1'
const listeners = new Set<() => void>()

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const s = JSON.parse(raw)
      return { custom: s.custom ?? [], progress: s.progress ?? {} }
    }
  } catch {
    /* defekte oder nicht verfügbare Daten: leer starten */
  }
  return { custom: [], progress: {} }
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

export function allOpenings(s: State): Opening[] {
  return [...OPENINGS, ...s.custom]
}

export function saveProgress(key: string, p: Progress) {
  set({ ...state, progress: { ...state.progress, [key]: p } })
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
    custom: state.custom.map((o) =>
      o.id === openingId ? { ...o, lines: o.lines.filter((l) => l.id !== lineId) } : o,
    ),
    progress: dropProgress(`${openingId}/${lineId}`),
  })
}

export function deleteRepertoire(openingId: string) {
  set({ custom: state.custom.filter((o) => o.id !== openingId), progress: dropProgress(`${openingId}/`) })
}

export function exportData(): string {
  return JSON.stringify(state, null, 2)
}

export function importData(json: string) {
  const s = JSON.parse(json)
  if (!s || !Array.isArray(s.custom) || typeof s.progress !== 'object') throw new Error('Ungültige Sicherung')
  set({ custom: s.custom, progress: s.progress })
}
