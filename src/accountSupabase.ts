import type { User } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import type { AccountProvider, AccountState, AuthStateListener, CreateAccountInput, SignInCredentials } from './account'
import type { UserProfile } from './types/workspace'

function getConfiguredSupabase() {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

function toUserProfile(user: User, displayName = ''): UserProfile {
  const createdAt = user.created_at
  return {
    id: user.id,
    displayName: displayName || String(user.user_metadata.displayName ?? user.user_metadata.display_name ?? ''),
    email: user.email ?? '',
    createdAt,
    updatedAt: new Date().toISOString(),
  }
}

async function syncProfile(user: User, displayName = '') {
  const profile = toUserProfile(user, displayName)
  const existing = await getConfiguredSupabase()
    .from('profiles')
    .select('id, display_name, email, created_at, updated_at')
    .eq('id', user.id)
    .maybeSingle()

  if (existing.error) throw existing.error
  if (existing.data) return profileFromRow(existing.data)

  const { data, error } = await getConfiguredSupabase()
    .from('profiles')
    .upsert({
      id: profile.id,
      display_name: profile.displayName,
      email: profile.email,
      created_at: profile.createdAt,
      updated_at: profile.updatedAt,
    })
    .select('id, display_name, email, created_at, updated_at')
    .single()

  if (error) throw error
  return profileFromRow(data)
}

function toAccountState(user: User | null): AccountState {
  return user ? { status: 'authenticated', user: toUserProfile(user) } : { status: 'unauthenticated', user: null }
}

function profileFromRow(row: { id: string; display_name: string; email: string; created_at: string; updated_at: string }): UserProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const supabaseAccountProvider: AccountProvider = {
  async getCurrentUser() {
    const { data, error } = await getConfiguredSupabase().auth.getUser()
    if (error) throw error
    return data.user ? syncProfile(data.user) : null
  },
  async signIn(credentials: SignInCredentials) {
    const { data, error } = await getConfiguredSupabase().auth.signInWithPassword(credentials)
    if (error || !data.user) throw error ?? new Error('Supabase sign-in did not return a user.')
    return syncProfile(data.user)
  },
  async updateProfile(displayName: string) {
    const { data: userData, error: userError } = await getConfiguredSupabase().auth.getUser()
    if (userError || !userData.user) throw userError ?? new Error('No authenticated user was found.')
    const { data, error } = await getConfiguredSupabase()
      .from('profiles')
      .update({ display_name: displayName.trim(), updated_at: new Date().toISOString() })
      .eq('id', userData.user.id)
      .select('id, display_name, email, created_at, updated_at')
      .single()
    if (error) throw error
    return profileFromRow(data)
  },
  async requestPasswordReset(email: string, redirectTo: string) {
    const { error } = await getConfiguredSupabase().auth.resetPasswordForEmail(email, { redirectTo })
    if (error) throw error
  },
  async updatePassword(password: string) {
    const { error } = await getConfiguredSupabase().auth.updateUser({ password })
    if (error) throw error
  },
  async signOut() {
    const { error } = await getConfiguredSupabase().auth.signOut()
    if (error) throw error
  },
  async createAccount(input: CreateAccountInput) {
    const { data, error } = await getConfiguredSupabase().auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: { displayName: input.displayName },
        emailRedirectTo: new URL('/', window.location.origin).toString(),
      },
    })
    if (error || !data.user) throw error ?? new Error('Supabase account creation did not return a user.')
    const profile = data.session ? await syncProfile(data.user, input.displayName) : toUserProfile(data.user, input.displayName)
    return { user: profile, authenticated: Boolean(data.session) }
  },
  onAuthStateChange(listener: AuthStateListener) {
    const { data } = getConfiguredSupabase().auth.onAuthStateChange((_event, session) => {
      listener(toAccountState(session?.user ?? null))
    })
    return () => data.subscription.unsubscribe()
  },
}