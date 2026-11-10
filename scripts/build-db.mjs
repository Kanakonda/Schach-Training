// Erzeugt src/data/db.json aus dem Datensatz lichess-org/chess-openings (CC0).
//
//   git clone https://github.com/lichess-org/chess-openings
//   npm install --no-save stockfish
//   node scripts/build-db.mjs chess-openings
//
// Aus den benannten Varianten werden Trainingslinien:
//  - nur Endpunkte (Linien, die kein Anfang einer längeren Linie sind)
//  - mindestens MIN_PLIES Halbzüge aus der Datenbank
//  - kürzere Linien werden mit Stockfish bis TARGET_PLIES Halbzüge fortgesetzt
//  - die Schlussstellung jeder Linie wird mit Stockfish bewertet
import { fork } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { Chess } from 'chess.js'

const MIN_PLIES = 5
const TARGET_PLIES = 14
const DEPTH = 16
const OUT = new URL('../src/data/db.json', import.meta.url)

function readRows(dir) {
  const rows = []
  for (const vol of 'abcde') {
    const text = fs.readFileSync(`${dir}/${vol}.tsv`, 'utf8').trim().split('\n').slice(1)
    for (const line of text) {
      const [eco, name, pgn] = line.split('\t')
      const chess = new Chess()
      const san = []
      const uci = []
      for (const tok of pgn.replace(/\d+\.+\s*/g, '').trim().split(/\s+/)) {
        const m = chess.move(tok)
        san.push(m.san)
        uci.push(m.from + m.to + (m.promotion ?? ''))
      }
      rows.push({ eco, name, san, uci })
    }
  }
  return rows
}

// ---------- Engine-Prozess: verlängert und bewertet einen Teil der Linien ----------
async function worker() {
  const require = createRequire(import.meta.url)
  let listener = null
  const engine = require('stockfish')('lite-single', (l) => listener?.(l))
  const send = (cmd, until) =>
    new Promise((resolve) => {
      let info = ''
      listener = (l) => {
        if (l.startsWith('info') && l.includes(' score ')) info = l
        if (until.test(l)) {
          listener = null
          resolve({ line: l, info })
        }
      }
      engine.processCommand(cmd)
    })
  await send('uci', /^uciok/)
  await send('isready', /^readyok/)

  const cache = new Map()
  async function search(chess, uci) {
    const key = chess.fen().split(' ').slice(0, 4).join(' ')
    if (!cache.has(key)) {
      engine.processCommand('position startpos moves ' + uci.join(' '))
      const { line, info } = await send(`go depth ${DEPTH}`, /^bestmove/)
      const [, kind, value] = info.match(/score (cp|mate) (-?\d+)/) ?? []
      let cp = kind === 'mate' ? Math.sign(Number(value) || -1) * 10000 : Number(value ?? 0)
      if (chess.turn() === 'b') cp = -cp
      cache.set(key, { best: line.split(' ')[1], cp })
    }
    return cache.get(key)
  }

  process.on('message', async (rows) => {
    const out = []
    for (const [n, row] of rows.entries()) {
      const chess = new Chess()
      for (const m of row.san) chess.move(m)
      const san = [...row.san]
      const uci = [...row.uci]
      while (san.length < TARGET_PLIES && !chess.isGameOver()) {
        const { best } = await search(chess, uci)
        const m = chess.move({ from: best.slice(0, 2), to: best.slice(2, 4), promotion: best[4] })
        san.push(m.san)
        uci.push(best)
      }
      let cp
      if (chess.isCheckmate()) cp = chess.turn() === 'w' ? -10000 : 10000
      else if (chess.isGameOver()) cp = 0
      else cp = (await search(chess, uci)).cp
      out.push([row.eco, row.name, san.join(' '), row.san.length, cp])
      if (n % 50 === 0) process.send({ progress: n })
    }
    process.send({ done: out })
    engine.terminate()
    process.exit(0)
  })
}

// ---------- Hauptprozess ----------
async function main() {
  const dir = process.argv[2]
  if (!dir) throw new Error('Aufruf: node scripts/build-db.mjs <Pfad zu chess-openings>')
  const rows = readRows(dir)
  const prefixes = new Set()
  for (const r of rows) for (let i = 1; i < r.san.length; i++) prefixes.add(r.san.slice(0, i).join(' '))
  const leaves = rows.filter((r) => r.san.length >= MIN_PLIES && !prefixes.has(r.san.join(' ')))
  console.log(`${rows.length} Einträge, ${leaves.length} Trainingslinien`)

  // Nach ECO-Band aufteilen: Zugumstellungen landen so fast immer im selben Prozess
  // und bekommen dieselbe Fortsetzung.
  const groups = [['C'], ['B'], ['A'], ['D', 'E']].map((vols) => leaves.filter((r) => vols.includes(r.eco[0])))
  const results = await Promise.all(
    groups.map(
      (group, i) =>
        new Promise((resolve, reject) => {
          const child = fork(fileURLToPath(import.meta.url), ['--worker'])
          child.on('message', (msg) => {
            if (msg.progress !== undefined) console.log(`Prozess ${i + 1}: ${msg.progress}/${group.length}`)
            if (msg.done) resolve(msg.done)
          })
          child.on('error', reject)
          child.send(group)
        }),
    ),
  )
  const byKey = new Map(results.flat().map((r) => [r[1] + '|' + r[2].split(' ').slice(0, r[3]).join(' '), r]))
  const lines = leaves.map((r) => byKey.get(r.name + '|' + r.san.join(' ')))
  fs.writeFileSync(
    OUT,
    JSON.stringify({
      source: 'lichess-org/chess-openings (CC0 1.0)',
      engine: `Stockfish 19 lite, Tiefe ${DEPTH}`,
      target: TARGET_PLIES,
      lines,
    }).replace(/\],\[/g, '],\n['),
  )
  console.log(`${lines.length} Linien geschrieben`)
}

if (process.argv.includes('--worker')) worker()
else main()
