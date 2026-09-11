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
  return {
    id: data.id,
    displayName: data.display_name,
    email: data.email,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  } satisfies UserProfile
}

function toAccountState(user: User | null): AccountState {
  return user ? { status: 'authenticated', user: toUserProfile(user) } : { status: 'unauthenticated', user: null }
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
  async signOut() {
    const { error } = await getConfiguredSupabase().auth.signOut()
    if (error) throw error
  },
  async createAccount(input: CreateAccountInput) {
    const { data, error } = await getConfiguredSupabase().auth.signUp({
      email: input.email,
      password: input.password,
      options: { data: { displayName: input.displayName } },
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