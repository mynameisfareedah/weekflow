export function canUseLegacyStorageFallback(supabaseConfigured: boolean, ownerId: string | null) {
  return !supabaseConfigured && ownerId === null
}

export function selectStorageValue<T>(scopedValue: T | null, legacyValue: T | null, allowLegacyFallback: boolean) {
  return scopedValue ?? (allowLegacyFallback ? legacyValue : null)
}