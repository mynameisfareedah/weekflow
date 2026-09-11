import type { UserProfile } from './types/workspace'
import { isSupabaseConfigured } from './lib/supabase'
import { supabaseAccountProvider } from './accountSupabase'

/**
 * Provider-neutral account boundary.
 *
 * The current implementation is local/demo compatibility only: it does not
 * authenticate users, persist credentials, or create a simulated session.
 * A future provider adapter can implement this boundary without leaking
 * provider-specific types into the WeekFlow domain model.
 */
export type AccountState =
  | { status: 'loading'; user: null }
  | { status: 'authenticated'; user: UserProfile }
  | { status: 'unauthenticated'; user: null }
  | { status: 'local-demo'; user: null }

export type AuthStateListener = (state: AccountState) => void

export type SignInCredentials = { email: string; password: string }
export type CreateAccountInput = SignInCredentials & { displayName: string }
export type CreateAccountResult = { user: UserProfile; authenticated: boolean }

export interface AccountProvider {
  getCurrentUser(): Promise<UserProfile | null>
  signIn(credentials: SignInCredentials): Promise<UserProfile>
  updateProfile(displayName: string): Promise<UserProfile>
  requestPasswordReset(email: string, redirectTo: string): Promise<void>
  updatePassword(password: string): Promise<void>
  signOut(): Promise<void>
  createAccount(input: CreateAccountInput): Promise<CreateAccountResult>
  onAuthStateChange(listener: AuthStateListener): () => void
}

const localDemoState: AccountState = { status: 'local-demo', user: null }

function unsupportedAuthentication(operation: string): Promise<never> {
  return Promise.reject(new Error(`${operation} is unavailable until an account provider is configured.`))
}

/** Local/demo compatibility provider; this is not secure authentication. */
const localDemoAccountProvider: AccountProvider = {
  getCurrentUser() {
    return Promise.resolve(null)
  },
  signIn() {
    return unsupportedAuthentication('Sign in')
  },
  updateProfile() {
    return unsupportedAuthentication('Profile update')
  },
  requestPasswordReset() {
    return unsupportedAuthentication('Password reset')
  },
  updatePassword() {
    return unsupportedAuthentication('Password update')
  },
  signOut() {
    return Promise.resolve()
  },
  createAccount() {
    return unsupportedAuthentication('Account creation')
  },
  onAuthStateChange(listener) {
    listener(localDemoState)
    return () => undefined
  },
}

/** Uses Supabase when configured; otherwise preserves local/demo compatibility. */
export const accountProvider: AccountProvider = isSupabaseConfigured ? supabaseAccountProvider : localDemoAccountProvider

export function getCurrentUser() {
  return accountProvider.getCurrentUser()
}

export function signIn(credentials: SignInCredentials) {
  return accountProvider.signIn(credentials)
}

export function updateProfile(displayName: string) {
  return accountProvider.updateProfile(displayName)
}

export function requestPasswordReset(email: string, redirectTo: string) {
  return accountProvider.requestPasswordReset(email, redirectTo)
}

export function updatePassword(password: string) {
  return accountProvider.updatePassword(password)
}

export function signOut() {
  return accountProvider.signOut()
}

export function createAccount(input: CreateAccountInput) {
  return accountProvider.createAccount(input)
}

export function onAuthStateChange(listener: AuthStateListener) {
  return accountProvider.onAuthStateChange(listener)
}
