const DESTINATION_EMAIL = 'bezanirsolutions@gmail.com'
const MAX_NAME_LENGTH = 120
const MAX_EMAIL_LENGTH = 254
const MAX_CATEGORY_LENGTH = 120
const MAX_MESSAGE_LENGTH = 5000

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
}

type SubmissionSource = 'support' | 'contact'

type Submission = {
  name: string
  email: string
  category: string
  message: string
  source: SubmissionSource
}

function jsonResponse(body: Record<string, string>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function isSubmission(value: unknown): value is Submission {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  return candidate.source === 'support'
    || candidate.source === 'contact'
    ? typeof candidate.name === 'string'
      && typeof candidate.email === 'string'
      && typeof candidate.category === 'string'
      && typeof candidate.message === 'string'
    : false
}

function clean(value: string, maxLength: number) {
  return value.trim().slice(0, maxLength)
}

function escapeSubject(value: string) {
  return clean(value, MAX_CATEGORY_LENGTH).replace(/[\r\n]/g, ' ')
}

function buildEmail(submission: Submission) {
  const name = clean(submission.name, MAX_NAME_LENGTH)
  const email = clean(submission.email, MAX_EMAIL_LENGTH)
  const category = escapeSubject(submission.category)
  const message = clean(submission.message, MAX_MESSAGE_LENGTH)
  const submitted = new Date().toISOString()
  const isContact = submission.source === 'contact'
  const title = isContact ? 'New WeekFlow Contact Message' : 'New WeekFlow Support Request'
  const subject = isContact ? `WeekFlow Contact — ${category}` : `WeekFlow Support Request — ${category}`
  const label = isContact ? 'Reason' : 'Category'

  return {
    subject,
    text: `${title}\n\nName: ${name}\nEmail: ${email}\n${label}: ${category}\n\nMessage:\n${message}\n\nSubmitted: ${submitted}\n`,
    replyTo: email,
  }
}

function sanitizeDiagnosticMessage(value: unknown) {
  if (typeof value !== 'string') return 'Brevo returned an error.'
  return value
    .replace(/bearer\s+[^\s]+/gi, 'Bearer [redacted]')
    .replace(/(api[-_]?key|authorization|token|password)\s*[:=]\s*[^,;\s]+/gi, '$1=[redacted]')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[redacted email]')
    .replace(/[A-Za-z0-9_-]{32,}/g, '[redacted token]')
    .slice(0, 240)
}

function sanitizeDiagnosticCode(value: unknown) {
  if (typeof value !== 'string' || !/^[a-z0-9_.-]{1,80}$/i.test(value)) return 'unknown'
  return value
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405)

  const apiKey = Deno.env.get('BREVO_API_KEY')
  const fromEmail = Deno.env.get('BREVO_FROM_EMAIL')
  if (!apiKey || !fromEmail) {
    console.error('Brevo email notification is not configured.')
    return jsonResponse({ error: 'Email notification is not configured.' }, 500)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'The request body is malformed.' }, 400)
  }

  if (!isSubmission(body)) return jsonResponse({ error: 'The request body is invalid.' }, 400)

  const submission = {
    name: clean(body.name, MAX_NAME_LENGTH),
    email: clean(body.email, MAX_EMAIL_LENGTH),
    category: clean(body.category, MAX_CATEGORY_LENGTH),
    message: clean(body.message, MAX_MESSAGE_LENGTH),
    source: body.source,
  }
  if (!submission.name || !submission.category || !submission.message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submission.email)) {
    return jsonResponse({ error: 'The submission is invalid.' }, 400)
  }

  const email = buildEmail(submission)
  const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { email: fromEmail, name: 'WeekFlow' },
      to: [{ email: DESTINATION_EMAIL }],
      replyTo: { email: email.replyTo },
      subject: email.subject,
      textContent: email.text,
    }),
  })

  if (!brevoResponse.ok) {
    const responseBody = await brevoResponse.text()
    try {
      const parsedBody: unknown = JSON.parse(responseBody)
      const diagnostic = parsedBody && typeof parsedBody === 'object' && !Array.isArray(parsedBody)
        ? parsedBody as Record<string, unknown>
        : {}
      console.error('Brevo notification failed', {
        status: brevoResponse.status,
        code: sanitizeDiagnosticCode(diagnostic.code),
        message: sanitizeDiagnosticMessage(diagnostic.message),
      })
    } catch {
      console.error('Brevo notification failed', {
        status: brevoResponse.status,
        message: 'Brevo returned a non-JSON error response.',
      })
    }
    return jsonResponse({ error: 'Email notification delivery failed.' }, 502)
  }

  return jsonResponse({ success: 'Email notification sent.' }, 202)
})
