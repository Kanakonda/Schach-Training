import { describe, expect, it } from 'vitest'
import { OPENINGS } from '../data/openings'
import { importPgn, movetextToLines, normalizeMoves } from './pgn'
import { review } from './srs'

describe('Eröffnungsdaten', () => {
  for (const o of OPENINGS) {
    for (const l of o.lines) {
      it(`${o.name} – ${l.name} ist legal`, () => {
        expect(normalizeMoves(l.moves)).toEqual(l.moves)
        const userMoves = l.moves.filter((_, i) => (i % 2 === 0) === (o.side === 'w'))
        expect(userMoves.length).toBeGreaterThan(3)
      })
    }
  }
  it('hat eindeutige IDs', () => {
    expect(new Set(OPENINGS.map((o) => o.id)).size).toBe(OPENINGS.length)
  })
})

describe('PGN-Import', () => {
  it('zerlegt Varianten in Linien', () => {
    const lines = movetextToLines('1. e4 e5 (1... c5 2. Nf3 (2. c3 Nf6) d6) 2. Nf3 {Kommentar} Nc6 $1 *')
    expect(lines).toEqual([
      ['e4', 'e5', 'Nf3', 'Nc6'],
      ['e4', 'c5', 'c3', 'Nf6'],
      ['e4', 'c5', 'Nf3', 'd6'],
    ])
  })
  it('liest mehrere Partien und überspringt FEN-Stellungen', () => {
    const pgn = `[Event "Italienisch"]
[White "Repertoire"]

1.e4 e5 2.Nf3 Nc6 3.Bc4! Bc5 1-0

[Event "Studie"]
[FEN "8/8/8/8/8/8/8/K6k w - - 0 1"]

1. Ka2 *

[Event "Zwei"]

1. d4 d5 2. c4 e6 (2... c6 3. Nf3) 3. Nc3 *`
    const r = importPgn(pgn)
    expect(r.lines.map((l) => l.moves.join(' '))).toEqual([
      'e4 e5 Nf3 Nc6 Bc4 Bc5',
      'd4 d5 c4 e6 Nc3',
      'd4 d5 c4 c6 Nf3',
    ])
    expect(r.skipped).toBe(1)
    expect(r.lines[0].name).toContain('Italienisch')
  })
  it('schneidet bei illegalen Zügen ab', () => {
    expect(normalizeMoves(['e4', 'e5', 'Ke3'])).toEqual(['e4', 'e5'])
  })
})

describe('Wiederholungen', () => {
  it('verlängert Abstände bei fehlerfreien Durchgängen', () => {
    const now = 1_000_000
    const a = review(undefined, 0, 8, now)
    const b = review(a, 0, 8, now)
    const c = review(b, 0, 8, now)
    expect([a.interval, b.interval, c.interval]).toEqual([1, 3, 8])
    expect(c.due).toBe(now + 8 * 86_400_000)
  })
  it('setzt bei vielen Fehlern zurück', () => {
    const now = 1_000_000
    const p = review(review(undefined, 0, 8, now), 4, 8, now)
    expect(p.reps).toBe(0)
    expect(p.due).toBe(now + 600_000)
    expect(p.wrong).toBe(4)
  })
})
