// Color follows the grade, never its rank among the grades present.
const GRADE_SLOT: Record<string, number> = {
  A92: 1,
  A95: 2,
  A95_PLUS: 3,
  A98: 4,
  DIESEL: 5,
  DIESEL_PLUS: 6,
}

export function gradeColor(grade: string): string {
  return `var(--chart-${GRADE_SLOT[grade] ?? 1})`
}
