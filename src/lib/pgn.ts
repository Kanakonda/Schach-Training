import { Chess } from 'chess.js'
import type { Line } from './types'

/** Prüft eine Zugfolge und gibt die Züge in sauberer SAN zurück (bis zum ersten ungültigen Zug). */
export function normalizeMoves(moves: string[]): string[] {
  const chess = new Chess()
  const out: string[] = []
  for (const m of moves) {
    try {
      out.push(chess.move(m).san)
    } catch {
      break
    }
  }
  return out
}

/** Zerlegt den Zugtext einer Partie (inkl. Varianten in Klammern) in einzelne Linien. */
export function movetextToLines(movetext: string): string[][] {
  const clean = movetext
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/;[^\n]*/g, ' ')
  const tokens = clean.match(/\(|\)|[^\s()]+/g) ?? []
  const lines: string[][] = []
  const stack: string[][] = []
  let current: string[] = []
  for (let tok of tokens) {
    if (tok === '(') {
      stack.push(current)
      current = current.slice(0, -1)
    } else if (tok === ')') {
      lines.push(current)
      current = stack.pop() ?? []
    } else {
      if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(tok) || tok.startsWith('$')) continue
      tok = tok.replace(/^\d+\.+/, '').replace(/[!?]+$/, '')
      if (tok && !/^\d+\.*$/.test(tok)) current.push(tok)
    }
  }
  lines.unshift(current)
  return lines
}

export interface PgnImport {
  lines: Line[]
  skipped: number
}

/** Liest PGN-Text (auch mehrere Partien mit Varianten) und erzeugt Trainingslinien. */
export function importPgn(pgn: string): PgnImport {
  const games = pgn.replace(/\r/g, '').split(/\n\s*\n(?=\s*\[)/)
  const lines: Line[] = []
  const seen = new Set<string>()
  let skipped = 0
  for (const game of games) {
    const headers: Record<string, string> = {}
    const movetext = game.replace(/^\s*\[(\w+)\s+"([^"]*)"\]\s*$/gm, (_, k, v) => {
      headers[k] = v
      return ''
    })
    if (!movetext.trim()) continue
    if (headers.FEN) {
      skipped++
      continue
    }
    const title = [headers.Event, headers.White].filter((s) => s && s !== '?').join(' – ')
    for (const raw of movetextToLines(movetext)) {
      const moves = normalizeMoves(raw)
      if (moves.length < 2) {
        if (raw.length) skipped++
        continue
      }
      const key = moves.join(' ')
      if (seen.has(key)) continue
      seen.add(key)
      const n = lines.length + 1
      lines.push({ id: `p${Date.now().toString(36)}${n}`, name: title ? `${title} (${n})` : `Linie ${n}`, moves })
    }
  }
  return { lines, skipped }
}

/** Zugliste als lesbarer Text: „1. e4 e5 2. Sf3 …“ mit deutschen Figurenbuchstaben. */
export function formatMoves(moves: string[]): string {
  return moves
    .map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}. ` : '') + german(m))
    .join(' ')
}

const DE: Record<string, string> = { N: 'S', B: 'L', R: 'T', Q: 'D', K: 'K' }
export function german(san: string): string {
  if (san.startsWith('O-O')) return san
  return san.replace(/[NBRQK]/g, (c) => DE[c])
}
