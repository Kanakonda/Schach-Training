import type { Line, Opening, Side } from '../lib/types'
import raw from './db.json'
import { OPENINGS } from './openings'

/** Datenbank-Familie → handgepflegter Grundkurs */
const COURSE: Record<string, string> = {
  'Italian Game': 'italienisch',
  'Ruy Lopez': 'spanisch',
  "Queen's Gambit": 'damengambit',
  'London System': 'london',
  'Scotch Game': 'schottisch',
  "King's Gambit": 'koenigsgambit',
  'Sicilian Defense': 'sizilianisch',
  'French Defense': 'franzoesisch',
  'Caro-Kann Defense': 'caro-kann',
  "King's Indian Defense": 'koenigsindisch',
  'Scandinavian Defense': 'skandinavisch',
  'Nimzo-Indian Defense': 'nimzoindisch',
}

/** Deutsche Namen für die übrigen Eröffnungsfamilien */
const GERMAN: Record<string, string> = {
  'Alekhine Defense': 'Aljechin-Verteidigung',
  'Benko Gambit': 'Wolga-Gambit',
  'Benoni Defense': 'Benoni-Verteidigung',
  'Bird Opening': 'Bird-Eröffnung',
  "Bishop's Opening": 'Läuferspiel',
  'Blackmar-Diemer Gambit': 'Blackmar-Diemer-Gambit',
  'Bogo-Indian Defense': 'Bogoindische Verteidigung',
  'Catalan Opening': 'Katalanische Eröffnung',
  'Center Game': 'Mittelgambit',
  'Colle System': 'Colle-System',
  'Danish Gambit': 'Nordisches Gambit',
  'Dutch Defense': 'Holländische Verteidigung',
  'Elephant Gambit': 'Elefantengambit',
  'English Defense': 'Englische Verteidigung',
  'English Opening': 'Englische Eröffnung',
  'Englund Gambit': 'Englund-Gambit',
  'Four Knights Game': 'Vierspringerspiel',
  'Grob Opening': 'Grobs Angriff',
  'Grünfeld Defense': 'Grünfeld-Indische Verteidigung',
  'Hungarian Opening': 'Ungarische Eröffnung',
  'Indian Defense': 'Indische Verteidigung',
  "King's Indian Attack": 'Königsindischer Angriff',
  "King's Pawn Game": 'Königsbauernspiel',
  'Latvian Gambit': 'Lettisches Gambit',
  'Modern Defense': 'Moderne Verteidigung',
  'Neo-Grünfeld Defense': 'Neo-Grünfeld-Verteidigung',
  'Nimzo-Larsen Attack': 'Nimzowitsch-Larsen-Angriff',
  'Nimzowitsch Defense': 'Nimzowitsch-Verteidigung',
  'Old Indian Defense': 'Altindische Verteidigung',
  'Owen Defense': 'Owen-Verteidigung',
  "Petrov's Defense": 'Russische Verteidigung',
  'Philidor Defense': 'Philidor-Verteidigung',
  'Pirc Defense': 'Pirc-Verteidigung',
  'Polish Opening': 'Orang-Utan (Sokolski)',
  'Ponziani Opening': 'Ponziani-Eröffnung',
  "Queen's Indian Defense": 'Damenindische Verteidigung',
  "Queen's Pawn Game": 'Damenbauernspiel',
  'Réti Opening': 'Réti-Eröffnung',
  'Richter-Veresov Attack': 'Richter-Weressow-Angriff',
  'Semi-Slav Defense': 'Halbslawische Verteidigung',
  'Slav Defense': 'Slawische Verteidigung',
  'Tarrasch Defense': 'Tarrasch-Verteidigung',
  'Three Knights Opening': 'Dreispringerspiel',
  'Torre Attack': 'Torre-Angriff',
  'Trompowsky Attack': 'Trompowsky-Angriff',
  'Vienna Game': 'Wiener Partie',
  'Vienna Gambit': 'Wiener Gambit',
  'Zukertort Opening': 'Zukertort-Eröffnung',
}

export const BASE_GROUP = 'Grundlinien'
export const OTHER_GROUP = 'Weitere Varianten'

/** „Queen's Gambit Declined: Exchange Variation“ → Familie „Queen's Gambit“ */
export function familyOf(name: string): string {
  return name.split(':')[0].split(',')[0].replace(/ (Accepted|Declined)$/, '').trim()
}

/** Zerlegt den Rest des Namens in Gruppe und Bezeichnung der Linie. */
export function splitName(name: string, family: string): { group: string; label: string } {
  const rest = name.slice(family.length).replace(/^[\s:,]+/, '')
  const m = rest.match(/^(Accepted|Declined)(?:[:,]\s*)?(.*)$/)
  const prefix = m ? (m[1] === 'Accepted' ? 'Angenommen' : 'Abgelehnt') : ''
  const [first, ...others] = (m ? m[2] : rest).split(', ')
  const group = [prefix, first].filter(Boolean).join(': ')
  return { group: group || 'Hauptvariante', label: others.join(', ') }
}

function defaultSide(family: string): Side {
  if (/Attack|Opening|Game|System/.test(family)) return 'w'
  return /Defense|Indian|Benoni|Counter|Benko|Latvian|Englund|Elephant|Duras/.test(family) ? 'b' : 'w'
}

function hash(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193)
  return (h >>> 0).toString(36)
}

const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

type Row = [eco: string, name: string, moves: string, book: number, cp: number]

function build(): { curated: Opening[]; families: Opening[] } {
  const curated: Opening[] = OPENINGS.map((o) => ({
    ...o,
    curated: true,
    lines: o.lines.map((l) => ({ ...l, group: BASE_GROUP })),
  }))
  const byCourse = new Map(curated.map((o) => [o.id, o]))
  const baseMoves = new Map(curated.map((o) => [o.id, o.lines.map((l) => l.moves.join(' ') + ' ')]))
  const families = new Map<string, Opening & { ecos: string[] }>()

  for (const [eco, name, moveText, book, cp] of raw.lines as Row[]) {
    const family = familyOf(name)
    const moves = moveText.split(' ')
    const bookText = moves.slice(0, book).join(' ')
    const { group, label } = splitName(name, family)
    const line: Line = {
      id: 'd' + hash(bookText),
      name: label ? `${group}, ${label}` : group,
      group,
      moves,
      book: book < moves.length ? book : undefined,
      eval: cp,
    }
    const course = byCourse.get(COURSE[family])
    if (course) {
      // Datenbanklinien, die nur der Anfang einer Grundlinie sind, bringen nichts Neues
      if (!baseMoves.get(course.id)!.some((m) => m.startsWith(bookText + ' '))) course.lines.push(line)
      continue
    }
    let fam = families.get(family)
    if (!fam) {
      fam = {
        id: 'db-' + slug(family),
        name: GERMAN[family] ?? family,
        intl: GERMAN[family] ? family : undefined,
        side: defaultSide(family),
        lines: [],
        ecos: [],
      }
      families.set(family, fam)
    }
    fam.lines.push(line)
    fam.ecos.push(eco)
  }

  const list = [...families.values()]
    .map(({ ecos, ...o }) => {
      const sorted = [...ecos].sort()
      const [min, max] = [sorted[0], sorted[sorted.length - 1]]
      return { ...o, eco: min === max ? min : `${min}–${max}` }
    })
    .sort((a, b) => b.lines.length - a.lines.length || a.name.localeCompare(b.name, 'de'))
  return { curated, families: list }
}

const built = build()

/** Die handgepflegten Grundkurse, ergänzt um alle Varianten aus der Datenbank */
export const CURATED: Opening[] = built.curated
/** Alle übrigen Eröffnungsfamilien aus der Datenbank */
export const FAMILIES: Opening[] = built.families
export const DB_INFO = { source: raw.source as string, engine: raw.engine as string, count: raw.lines.length }

const byId = new Map([...CURATED, ...FAMILIES].map((o) => [o.id, o]))
const flipped = new Map<string, Opening>()

/** Dieselbe Eröffnung aus Sicht der anderen Farbe; der Lernstand wird getrennt geführt. */
export function withSide(o: Opening, side: Side): Opening {
  const base = byId.get(o.id.split('~')[0]) ?? o
  if (base.side === side || base.custom) return base
  const id = `${base.id}~${side}`
  if (!flipped.has(id)) flipped.set(id, { ...base, id, side })
  return flipped.get(id)!
}

export function findOpening(custom: Opening[], id: string): Opening | undefined {
  const [baseId, side] = id.split('~')
  const base = byId.get(baseId) ?? custom.find((o) => o.id === baseId)
  return base && side ? withSide(base, side as Side) : base
}

export interface Group {
  name: string
  lines: Line[]
}

/** Gruppiert die Linien einer Eröffnung; Gruppen mit nur einer Linie werden zusammengefasst. */
export function groupsOf(o: Opening): Group[] {
  const map = new Map<string, Line[]>()
  for (const l of o.lines) {
    const g = l.group ?? ''
    if (!map.has(g)) map.set(g, [])
    map.get(g)!.push(l)
  }
  if (map.size <= 1) return [{ name: '', lines: o.lines }]
  const groups: Group[] = []
  const rest: Line[] = []
  for (const [name, lines] of map) {
    if (lines.length > 1 || name === BASE_GROUP) groups.push({ name, lines })
    else rest.push(...lines)
  }
  if (rest.length) groups.push({ name: groups.length ? OTHER_GROUP : '', lines: rest })
  return groups
}

/** Bezeichnung einer Linie innerhalb ihrer Gruppe */
export function labelIn(line: Line, group: string): string {
  if (group && group === line.group && line.name.startsWith(group)) {
    return line.name.slice(group.length).replace(/^, /, '') || 'Hauptlinie'
  }
  return line.name
}
