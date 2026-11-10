export interface Progress {
  reps: number
  /** Abstand bis zur nächsten Wiederholung in Tagen */
  interval: number
  ease: number
  due: number
  correct: number
  wrong: number
  last: number
}

export type Grade = 'again' | 'hard' | 'good'

const DAY = 24 * 60 * 60 * 1000

export function gradeFor(mistakes: number): Grade {
  if (mistakes === 0) return 'good'
  return mistakes <= 2 ? 'hard' : 'again'
}

export function review(prev: Progress | undefined, mistakes: number, userMoves: number, now = Date.now()): Progress {
  const p: Progress = prev ?? { reps: 0, interval: 0, ease: 2.5, due: now, correct: 0, wrong: 0, last: now }
  const grade = gradeFor(mistakes)
  let { reps, interval, ease } = p
  if (grade === 'again') {
    reps = 0
    interval = 0
    ease = Math.max(1.3, ease - 0.2)
  } else if (grade === 'hard') {
    interval = Math.max(1, Math.round(interval * 1.2))
    ease = Math.max(1.3, ease - 0.15)
    reps += 1
  } else {
    interval = reps === 0 ? 1 : reps === 1 ? 3 : Math.round(interval * ease)
    reps += 1
  }
  return {
    reps,
    interval,
    ease,
    due: grade === 'again' ? now + 10 * 60 * 1000 : now + interval * DAY,
    correct: p.correct + Math.max(0, userMoves - Math.min(mistakes, userMoves)),
    wrong: p.wrong + mistakes,
    last: now,
  }
}

export function dueLabel(p: Progress | undefined, now = Date.now()): string {
  if (!p) return 'neu'
  if (p.due <= now) return 'fällig'
  const days = Math.ceil((p.due - now) / DAY)
  return days <= 1 ? 'morgen' : `in ${days} Tagen`
}
