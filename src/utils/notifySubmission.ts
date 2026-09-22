import type { SupabaseClient } from '@supabase/supabase-js'

type SubmissionSource = 'support' | 'contact'

type SubmissionNotification = {
  name: string
  email: string
  category: string
  message: string
  source: SubmissionSource
}

export async function notifySubmission(supabaseClient: SupabaseClient, submission: SubmissionNotification): Promise<boolean> {
  try {
    const { error } = await supabaseClient.functions.invoke('notify-support-request', { body: submission })
    return !error
  } catch {
    // The database insert is the source of record; notification failure must not discard it.
    return false
  }
}
