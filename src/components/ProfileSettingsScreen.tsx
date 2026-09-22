import { useState, type FormEvent } from 'react'
import { deleteAccount, requestPasswordReset, updatePassword, updateProfile } from '../account'
import { setCurrentWorkspaceId } from '../storage/workspaceStorage'
import type { UserProfile, Workspace } from '../types/workspace'
import { getStoredThemePreference, saveThemePreference, type ThemePreference } from '../theme'

const passwordMinimumLength = 8

function getInitials(user: UserProfile) {
  const source = user.displayName.trim() || user.email.trim()
  const words = source.split(/\s+/).filter(Boolean)
  return words.length > 1 ? `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase() : (words[0]?.slice(0, 2) || 'WF').toUpperCase()
}

function readableError(error: unknown) {
  if (error instanceof TypeError || (error instanceof Error && /network|fetch|connection|offline/i.test(error.message))) {
    return 'We could not connect right now. Check your connection and try again.'
  }
  return 'Unable to save changes right now. Please try again.'
}

function readableDeletionError(error: unknown) {
  if (error instanceof TypeError || (error instanceof Error && /network|fetch|connection|offline/i.test(error.message))) {
    return 'We could not connect right now. Check your connection and try again.'
  }
  if (error instanceof Error && /session has expired|account could not be deleted|account deletion is not configured/i.test(error.message)) {
    return error.message
  }
  return 'Your account could not be deleted. Please try again.'
}

export default function ProfileSettingsScreen({ user, workspaces, currentWorkspaceId, onProfileUpdated, onWorkspaceSelected, onSignOut, onAccountDeleted, onClose }: {
  user: UserProfile
  workspaces: Workspace[]
  currentWorkspaceId: string | null
  onProfileUpdated: (profile: UserProfile) => void
  onWorkspaceSelected: (workspaceId: string) => void
  onSignOut: () => void
  onAccountDeleted: () => void
  onClose: () => void
}) {
  const [username, setUsername] = useState(user.displayName)
  const [profileError, setProfileError] = useState('')
  const [profileStatus, setProfileStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordStatus, setPasswordStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [resetStatus, setResetStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [resetMessage, setResetMessage] = useState('')
  const [themePreference, setThemePreference] = useState<ThemePreference>(getStoredThemePreference)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'deleting'>('idle')
  const [deleteError, setDeleteError] = useState('')

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setProfileError('')
    setProfileStatus('idle')
    const trimmedUsername = username.trim()
    if (!trimmedUsername) {
      setProfileError('Enter a username.')
      return
    }
    if (trimmedUsername.length < 2) {
      setProfileError('Enter a username with at least 2 characters.')
      return
    }
    if (trimmedUsername.length > 80) {
      setProfileError('Keep your username to 80 characters or fewer.')
      return
    }
    if (trimmedUsername === user.displayName.trim()) {
      setProfileStatus('saved')
      return
    }

    setProfileStatus('saving')
    try {
      const profile = await updateProfile(trimmedUsername)
      onProfileUpdated(profile)
      setUsername(profile.displayName)
      setProfileStatus('saved')
    } catch (error) {
      setProfileError(readableError(error))
      setProfileStatus('idle')
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordError('')
    setPasswordStatus('idle')
    if (!newPassword) {
      setPasswordError('Enter a new password.')
      return
    }
    if (newPassword.length < passwordMinimumLength) {
      setPasswordError(`Your password must be at least ${passwordMinimumLength} characters.`)
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.')
      return
    }

    setPasswordStatus('saving')
    try {
      await updatePassword(newPassword)
      setNewPassword('')
      setConfirmPassword('')
      setPasswordStatus('saved')
    } catch (error) {
      setPasswordError(readableError(error))
      setPasswordStatus('idle')
    }
  }

  async function sendPasswordReset() {
    setResetMessage('')
    setResetStatus('sending')
    try {
      const redirectTo = new URL('/reset-password', window.location.origin).toString()
      await requestPasswordReset(user.email, redirectTo)
      setResetStatus('sent')
      setResetMessage('A password reset link has been sent to your email.')
    } catch (error) {
      setResetStatus('idle')
      setResetMessage(readableError(error))
    }
  }

  function selectWorkspace(workspaceId: string) {
    if (workspaceId === currentWorkspaceId) return
    if (setCurrentWorkspaceId(workspaceId)) onWorkspaceSelected(workspaceId)
  }

  function selectTheme(preference: ThemePreference) {
    setThemePreference(preference)
    saveThemePreference(preference)
  }

  async function confirmAccountDeletion() {
    if (deleteStatus === 'deleting') return
    setDeleteError('')
    setDeleteStatus('deleting')
    try {
      await deleteAccount()
      onAccountDeleted()
    } catch (error) {
      setDeleteError(readableDeletionError(error))
      setDeleteStatus('idle')
    }
  }

  return <main className="profile-settings-screen" aria-labelledby="profile-settings-title">
    <div className="profile-settings-header"><div><p className="eyebrow">Account</p><h1 id="profile-settings-title">Profile Settings</h1><p>Manage your WeekFlow account and personal preferences.</p></div><button className="button button-secondary profile-settings-close" type="button" onClick={onClose} aria-label="Close Profile Settings">Close</button></div>
    <div className="profile-settings-grid">
      <section className="profile-settings-section profile-identity-section" aria-labelledby="profile-section-title"><div className="profile-settings-section-heading"><div><p className="eyebrow">Profile</p><h2 id="profile-section-title">Your profile</h2></div><div className="profile-avatar-large" aria-hidden="true">{getInitials(user)}</div></div><form className="profile-settings-form" onSubmit={saveProfile} noValidate><label className="profile-field"><span>Username</span><input value={username} maxLength={80} onChange={(event) => { setUsername(event.target.value); setProfileStatus('idle'); setProfileError('') }} autoComplete="name" aria-invalid={Boolean(profileError)} /><small>This is the name WeekFlow uses to greet you.</small></label><label className="profile-field"><span>Email address</span><input value={user.email} readOnly aria-describedby="profile-email-note" /><small id="profile-email-note">This is your WeekFlow account login email.</small></label>{profileError && <p className="profile-message profile-error" role="alert">{profileError}</p>}<div className="profile-action-row"><button className="button button-primary" type="submit" disabled={profileStatus === 'saving'}>{profileStatus === 'saving' ? 'Saving...' : 'Save Changes'}</button>{profileStatus === 'saved' && <span className="profile-saved" role="status">Saved</span>}</div></form></section>
      <section className="profile-settings-section" aria-labelledby="security-section-title"><div className="profile-settings-section-heading"><div><p className="eyebrow">Account &amp; Security</p><h2 id="security-section-title">Security</h2></div></div><p className="profile-section-intro">Update your password, request a reset link, or sign out of your WeekFlow account.</p><form className="profile-settings-form" onSubmit={changePassword} noValidate><label className="profile-field"><span>New password</span><input type="password" value={newPassword} onChange={(event) => { setNewPassword(event.target.value); setPasswordStatus('idle'); setPasswordError('') }} autoComplete="new-password" /></label><label className="profile-field"><span>Confirm new password</span><input type="password" value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setPasswordStatus('idle'); setPasswordError('') }} autoComplete="new-password" /></label>{passwordError && <p className="profile-message profile-error" role="alert">{passwordError}</p>}<div className="profile-action-row"><button className="button button-secondary" type="submit" disabled={passwordStatus === 'saving'}>{passwordStatus === 'saving' ? 'Saving...' : 'Change Password'}</button>{passwordStatus === 'saved' && <span className="profile-saved" role="status">Saved</span>}</div></form><div className="profile-account-actions"><button className="button button-secondary" type="button" onClick={sendPasswordReset} disabled={resetStatus === 'sending'}>{resetStatus === 'sending' ? 'Sending...' : 'Send reset link'}</button><button className="button button-ghost" type="button" onClick={onSignOut}>Sign out</button></div>{resetMessage && <p className={resetStatus === 'sent' ? 'profile-message profile-success' : 'profile-message profile-error'} role={resetStatus === 'sent' ? 'status' : 'alert'}>{resetMessage}</p>}</section>
      <section className="profile-settings-section" aria-labelledby="preferences-section-title"><div className="profile-settings-section-heading"><div><p className="eyebrow">Preferences</p><h2 id="preferences-section-title">WeekFlow preferences</h2></div></div><label className="profile-field"><span>Default workspace</span><select value={currentWorkspaceId ?? ''} onChange={(event) => selectWorkspace(event.target.value)}><option value="" disabled>{workspaces.length > 0 ? 'Select a workspace' : 'No workspaces yet'}</option>{workspaces.filter((workspace) => !workspace.archived).map((workspace) => <option value={workspace.id} key={workspace.id}>{workspace.name}</option>)}</select><small>Your selected workspace is kept as the workspace you return to.</small></label><div className="profile-preference-static"><span>Week starts Monday</span><small>The WeekFlow calendar runs Monday through Sunday.</small></div></section>
      <section className="profile-settings-section" aria-labelledby="appearance-section-title"><div className="profile-settings-section-heading"><div><p className="eyebrow">Appearance</p><h2 id="appearance-section-title">Appearance</h2></div></div><p className="profile-section-intro">Customize how WeekFlow looks on your device.</p><fieldset className="theme-options"><legend>Theme</legend>{([['light', 'Light'], ['dark', 'Dark'], ['system', 'System default']] as const).map(([value, label]) => <label className={`theme-option${themePreference === value ? ' is-selected' : ''}`} key={value}><input type="radio" name="theme" value={value} checked={themePreference === value} onChange={() => selectTheme(value)} /><span>{label}</span></label>)}</fieldset></section>
      <section className="profile-settings-section profile-account-section" aria-labelledby="account-section-title"><div className="profile-settings-section-heading"><div><p className="eyebrow">Account</p><h2 id="account-section-title">Account information</h2></div></div><dl className="profile-account-details"><div><dt>Account email</dt><dd>{user.email}</dd></div><div><dt>Workspaces</dt><dd>{workspaces.filter((workspace) => !workspace.archived).length}</dd></div></dl></section>
      <section className="profile-settings-section profile-danger-section" aria-labelledby="danger-zone-title"><div className="profile-settings-section-heading"><div><p className="eyebrow">Account</p><h2 id="danger-zone-title">Danger Zone</h2></div></div><p className="profile-section-intro">Permanently delete your WeekFlow account and associated data.</p><button className="button button-danger-ghost" type="button" onClick={() => { setDeleteError(''); setDeleteDialogOpen(true) }}>Delete Account</button></section>
    </div>
    {deleteDialogOpen && <div className="workspace-modal-backdrop profile-delete-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-account-title"><div className="workspace-modal profile-delete-dialog"><div className="workspace-modal-header"><div><p className="eyebrow">Danger Zone</p><h2 id="delete-account-title">Delete your WeekFlow account?</h2></div><button type="button" className="workspace-modal-close" onClick={() => { if (deleteStatus !== 'deleting') setDeleteDialogOpen(false) }} aria-label="Close delete account dialog" disabled={deleteStatus === 'deleting'}>×</button></div><p className="workspace-modal-intro">This permanently deletes your account and associated WeekFlow data. This action cannot be undone.</p>{deleteError && <p className="profile-message profile-error" role="alert">{deleteError}</p>}<div className="workspace-modal-actions"><button type="button" className="button button-secondary" onClick={() => setDeleteDialogOpen(false)} disabled={deleteStatus === 'deleting'}>Cancel</button><button type="button" className="button button-danger" onClick={confirmAccountDeletion} disabled={deleteStatus === 'deleting'}>{deleteStatus === 'deleting' ? 'Deleting Account...' : 'Delete Account'}</button></div></div></div>}
  </main>
}
