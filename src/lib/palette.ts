// Data colors used by charts and marks. Text never wears these; identity comes
// from a colored mark beside muted text. Status colors always ship with a label.
export const palette = {
  recovery: '#d4ed85',
  strain: '#f0b26b',
  sleep: '#b7a3de',
  hrv: '#92cddd',
  rhr: '#e19789',
  deep: '#766795',
  rem: '#b7a3de',
  light: '#ddd3ed',
  awake: '#3a3d36',
  none: '#5c6057',
} as const

export function recoveryTone(score: number | null | undefined) {
  return score == null
    ? { color: palette.none, label: 'Not scored yet' }
    : score >= 67
      ? { color: '#d4ed85', label: 'High' }
      : score >= 34
        ? { color: '#f4a53a', label: 'Moderate' }
        : { color: '#f26b65', label: 'Low' }
}
