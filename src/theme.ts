export type ThemePreference = 'light' | 'dark' | 'system'

export const THEME_STORAGE_KEY = 'weekflow-theme'

export function getStoredThemePreference(): ThemePreference {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY)
    return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
  } catch {
    return 'system'
  }
}

export function getSystemTheme(): Exclude<ThemePreference, 'system'> {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function resolveTheme(preference: ThemePreference): Exclude<ThemePreference, 'system'> {
  return preference === 'system' ? getSystemTheme() : preference
}

export function applyTheme(preference: ThemePreference) {
  const resolvedTheme = resolveTheme(preference)
  document.documentElement.dataset.theme = resolvedTheme
  document.documentElement.style.colorScheme = resolvedTheme
  return resolvedTheme
}

export function saveThemePreference(preference: ThemePreference) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // Preferences can be unavailable in restricted browsing modes.
  }
  applyTheme(preference)
  window.dispatchEvent(new CustomEvent('weekflow-theme-change', { detail: preference }))
}
