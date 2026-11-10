export type Side = 'w' | 'b'

export interface Line {
  id: string
  name: string
  /** Untergruppe innerhalb der Eröffnung, z. B. „Najdorf Variation“ */
  group?: string
  /** Kurze Erklärung der Idee hinter der Linie */
  idea?: string
  /** Züge in SAN, beginnend mit dem ersten weißen Zug */
  moves: string[]
  /** Anzahl Halbzüge aus der Datenbank; danach folgt die Stockfish-Fortsetzung */
  book?: number
  /** Stockfish-Bewertung der Schlussstellung in Hundertstel Bauern aus Sicht von Weiß */
  eval?: number
}

export interface Opening {
  id: string
  name: string
  /** Internationale (englische) Bezeichnung, falls sie vom Namen abweicht */
  intl?: string
  eco?: string
  /** Die Seite, die du spielst */
  side: Side
  description?: string
  lines: Line[]
  custom?: boolean
  curated?: boolean
}
