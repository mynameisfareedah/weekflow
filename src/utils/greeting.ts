export function getTimeAwareGreeting(name: string) {
  const hour = new Date().getHours()
  const displayName = name.trim() || 'there'
  const greeting = hour >= 5 && hour < 12 ? 'Good morning' : hour >= 12 && hour < 18 ? 'Good afternoon' : 'Good evening'
  return `${greeting}, ${displayName}`
}