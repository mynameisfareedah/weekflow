export const WEEK_DAY_IDS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
export const WEEK_DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const

export function getWeekEndDate(weekStart: string) {
  const end = new Date(`${weekStart}T12:00:00`)
  end.setDate(end.getDate() + 6)
  return end
}

export function formatWeekRange(weekStart: string, includeYear = true) {
  const start = new Date(`${weekStart}T12:00:00`)
  const end = getWeekEndDate(weekStart)
  const startLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(start)
  const endLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', ...(includeYear ? { year: 'numeric' } : {}) }).format(end)
  return `${startLabel} - ${endLabel}`
}
