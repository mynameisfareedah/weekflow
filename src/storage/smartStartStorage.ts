export type SmartStartCompletion = 'started' | 'fresh'

const STORAGE_PREFIX = 'weekflow-smart-start:'

export function loadSmartStartCompletion(weekStart: string): SmartStartCompletion | null {
  try {
    const value = window.localStorage.getItem(`${STORAGE_PREFIX}${weekStart}`)
    return value === 'started' || value === 'fresh' ? value : null
  } catch {
    return null
  }
}

export function saveSmartStartCompletion(weekStart: string, completion: SmartStartCompletion) {
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${weekStart}`, completion)
  } catch {
    // Storage can be unavailable in private browsing or restricted environments.
  }
}
