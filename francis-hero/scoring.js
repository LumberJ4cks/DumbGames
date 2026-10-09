import { CHART } from './data.js'

/* Règles de score de Francis Hero, partagées entre le jeu et la validation serveur. */
export const POINTS = { perfect: 100, good: 50 }
export const COMBO_STEP = 10
export const MAX_MULTIPLIER = 4
export const NOTE_COUNT = CHART.length

export function multiplierForCombo(combo) {
  return Math.min(MAX_MULTIPLIER, 1 + Math.floor(combo / COMBO_STEP))
}
export function accuracy({ perfect, good, miss }) {
  const total = perfect + good + miss
  return total === 0 ? 0 : (perfect + good * 0.6) / total
}
export function gradeForResult(result) {
  const acc = accuracy(result)
  if (acc > 0.95) return 'S'
  if (acc > 0.85) return 'A'
  if (acc > 0.7) return 'B'
  if (acc > 0.5) return 'C'
  return 'D'
}
/** Un résultat est plausible si chaque note est jugée une fois et si le score tient dans ce que les touches pouvaient rapporter. */
export function isPlausibleResult(result) {
  const { score, maxCombo, perfect, good, miss } = result
  const values = [score, maxCombo, perfect, good, miss]
  if (!values.every((v) => Number.isInteger(v) && v >= 0)) return false
  if (perfect + good + miss !== NOTE_COUNT) return false
  const hits = perfect + good
  if (maxCombo > hits) return false
  if (hits === 0) return score === 0 && maxCombo === 0
  let upper = 0
  for (let combo = 1; combo <= hits; combo++) upper += (combo > good ? POINTS.perfect : POINTS.good) * multiplierForCombo(combo)
  return score <= upper
}
