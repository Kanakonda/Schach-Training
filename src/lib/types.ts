export type Side = 'w' | 'b'

export interface Line {
  id: string
  name: string
  /** Kurze Erklärung der Idee hinter der Linie */
  idea?: string
  /** Züge in SAN, beginnend mit dem ersten weißen Zug */
  moves: string[]
}

export interface Opening {
  id: string
  name: string
  eco?: string
  /** Die Seite, die du spielst */
  side: Side
  description?: string
  lines: Line[]
  custom?: boolean
}
