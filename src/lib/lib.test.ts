import { describe, expect, it } from 'vitest'
import { CURATED, FAMILIES, familyOf, findOpening, groupsOf, splitName, withSide } from '../data/catalog'
import { OPENINGS } from '../data/openings'
import { formatCp, formatScore, parseInfo, whiteShare } from './engine'
import { importPgn, movetextToLines, normalizeMoves } from './pgn'
import { review } from './srs'
import { learnedLines } from './store'

describe('Grundkurse', () => {
  for (const o of OPENINGS) {
    for (const l of o.lines) {
      it(`${o.name} – ${l.name} ist legal`, () => {
        expect(normalizeMoves(l.moves)).toEqual(l.moves)
        const userMoves = l.moves.filter((_, i) => (i % 2 === 0) === (o.side === 'w'))
        expect(userMoves.length).toBeGreaterThan(3)
      })
    }
  }
  it('haben eindeutige IDs', () => {
    expect(new Set(OPENINGS.map((o) => o.id)).size).toBe(OPENINGS.length)
  })
})

describe('Eröffnungsdatenbank', () => {
  const all = [...CURATED, ...FAMILIES]

  it('enthält nur legale Zugfolgen', () => {
    let count = 0
    for (const o of all)
      for (const l of o.lines) {
        if (normalizeMoves(l.moves).join(' ') !== l.moves.join(' ')) throw new Error(`${o.name} – ${l.name}`)
        count++
      }
    expect(count).toBeGreaterThan(2000)
  })

  it('hat eindeutige IDs für Eröffnungen und Linien', () => {
    expect(new Set(all.map((o) => o.id)).size).toBe(all.length)
    for (const o of all) expect(new Set(o.lines.map((l) => l.id)).size, o.name).toBe(o.lines.length)
  })

  it('ergänzt die Grundkurse um Datenbankvarianten', () => {
    const size = (id: string) => CURATED.find((o) => o.id === id)!.lines.length
    expect(size('italienisch')).toBeGreaterThan(50)
    expect(size('sizilianisch')).toBeGreaterThan(150)
    expect(size('damengambit')).toBeGreaterThan(100)
    // Die Grundlinien stehen weiterhin vorn und behalten ihre IDs
    expect(CURATED[0].lines.slice(0, 4).map((l) => l.id)).toEqual(['l1', 'l2', 'l3', 'l4'])
  })

  it('verlängert kurze Linien und bewertet jede Schlussstellung', () => {
    for (const o of all)
      for (const l of o.lines.filter((l) => l.id.startsWith('d'))) {
        expect(l.moves.length, l.name).toBeGreaterThanOrEqual(l.moves.at(-1)!.endsWith('#') ? 5 : 14)
        expect(typeof l.eval, l.name).toBe('number')
        if (l.book !== undefined) expect(l.book).toBeLessThan(l.moves.length)
      }
  })

  it('zerlegt Namen in Familie, Gruppe und Linie', () => {
    expect(familyOf("Queen's Gambit Declined: Exchange Variation, Positional Variation")).toBe("Queen's Gambit")
    expect(splitName("Queen's Gambit Declined: Exchange Variation, Positional Variation", "Queen's Gambit")).toEqual({
      group: 'Abgelehnt: Exchange Variation',
      label: 'Positional Variation',
    })
    expect(familyOf("Queen's Indian Defense, with e3")).toBe("Queen's Indian Defense")
    expect(splitName('Sicilian Defense', 'Sicilian Defense')).toEqual({ group: 'Hauptvariante', label: '' })
  })

  it('gruppiert Linien und fasst Einzelgänger zusammen', () => {
    const groups = groupsOf(CURATED.find((o) => o.id === 'sizilianisch')!)
    expect(groups[0].name).toBe('Grundlinien')
    expect(groups.find((g) => g.name === 'Najdorf Variation')!.lines.length).toBeGreaterThan(5)
    expect(groups.reduce((a, g) => a + g.lines.length, 0)).toBe(CURATED.find((o) => o.id === 'sizilianisch')!.lines.length)
  })

  it('führt den Lernstand je Farbe getrennt', () => {
    const base = findOpening([], 'sizilianisch')!
    const white = withSide(base, 'w')
    expect(base.side).toBe('b')
    expect(white.id).toBe('sizilianisch~w')
    expect(withSide(white, 'b')).toBe(base)
    expect(findOpening([], 'sizilianisch~w')).toBe(white)
    const p = { reps: 1, interval: 1, ease: 2.5, due: 0, correct: 5, wrong: 0, last: 0 }
    const learned = learnedLines({ custom: [], progress: { 'sizilianisch/l1': p, 'sizilianisch~w/l2': p, 'weg/x': p } })
    expect(learned.map((l) => `${l.opening.side}:${l.line.id}`)).toEqual(['b:l1', 'w:l2'])
  })
})

describe('Stockfish-Ausgabe', () => {
  const info = 'info depth 18 seldepth 24 multipv 2 score cp 34 nodes 1 nps 1 time 1 pv e2e4 e7e5 g1f3'
  it('liest Tiefe, Variante und Bewertung', () => {
    expect(parseInfo(info, 'w')).toEqual({ depth: 18, index: 1, pv: { cp: 34, moves: ['e2e4', 'e7e5', 'g1f3'] } })
  })
  it('rechnet die Bewertung auf die Sicht von Weiß um', () => {
    expect(parseInfo(info, 'b')!.pv.cp).toBe(-34)
    expect(parseInfo('info depth 9 score mate 3 pv d8h4', 'b')!.pv.mate).toBe(-3)
  })
  it('ignoriert Zwischenstände und andere Zeilen', () => {
    expect(parseInfo('info depth 12 score cp 20 lowerbound pv e2e4', 'w')).toBeNull()
    expect(parseInfo('info depth 12 currmove e2e4 currmovenumber 1', 'w')).toBeNull()
    expect(parseInfo('bestmove e2e4 ponder e7e5', 'w')).toBeNull()
  })
  it('formatiert Bewertungen', () => {
    expect(formatCp(34)).toBe('+0,3')
    expect(formatCp(-152)).toBe('−1,5')
    expect(formatCp(0)).toBe('0,0')
    expect(formatCp(-3)).toBe('0,0')
    expect(formatScore({ mate: -3, moves: [] })).toBe('−#3')
    expect(whiteShare({ cp: 0, moves: [] })).toBe(50)
    expect(whiteShare({ cp: 300, moves: [] })).toBeGreaterThan(70)
    expect(whiteShare({ mate: -1, moves: [] })).toBe(0)
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
