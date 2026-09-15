import { createClient } from '@supabase/supabase-js'

interface ServerEnv {
  SUPABASE_URL?: string
  VITE_SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  ALLOWED_ORIGINS?: string
  URL?: string
  DEPLOY_PRIME_URL?: string
  DEPLOY_URL?: string
}

const env = (globalThis as typeof globalThis & {
  process?: { env?: ServerEnv }
}).process?.env ?? {}

function jsonResponse(body: Record<string, boolean | string>, status: number, origin?: string) {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (origin) headers.set('Access-Control-Allow-Origin', origin)
  headers.set('Vary', 'Origin')
  return new Response(JSON.stringify(body), { status, headers })
}

function allowedOrigins() {
  return new Set([
    ...(env.ALLOWED_ORIGINS ?? '').split(',').map((origin) => origin.trim()).filter(Boolean),
    env.URL,
    env.DEPLOY_PRIME_URL,
    env.DEPLOY_URL,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ].filter((origin): origin is string => Boolean(origin)))
}

function getBearerToken(request: Request) {
  const header = request.headers.get('authorization')
  const match = header?.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

export default async function handler(request: Request) {
  const origin = request.headers.get('origin') ?? undefined
  if (origin && !allowedOrigins().has(origin)) {
    return jsonResponse({ error: 'Origin is not allowed.' }, 403)
  }

  if (request.method === 'OPTIONS') {
    if (!origin) return new Response(null, { status: 204 })
    const headers = new Headers({
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Origin': origin,
      Vary: 'Origin',
    })
    return new Response(null, { status: 204, headers })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405, origin)
  }

  const accessToken = getBearerToken(request)
  if (!accessToken) {
    return jsonResponse({ error: 'Authentication is required.' }, 401, origin)
  }

  const contentType = request.headers.get('content-type') ?? ''
  const rawBody = await request.text()
  if (rawBody.trim()) {
    if (!contentType.toLowerCase().includes('application/json')) {
      return jsonResponse({ error: 'The request body must be JSON.' }, 400, origin)
    }
    try {
      const body: unknown = JSON.parse(rawBody)
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return jsonResponse({ error: 'The request body must be a JSON object.' }, 400, origin)
      }
    } catch {
      return jsonResponse({ error: 'The request body is malformed.' }, 400, origin)
    }
  }

  const supabaseUrl = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Account deletion is not configured.' }, 500, origin)
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken)
  if (userError || !userData.user) {
    return jsonResponse({ error: 'The authentication session is invalid or expired.' }, 401, origin)
  }

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userData.user.id)
  if (deleteError) {
    console.error('Account deletion failed.', { code: deleteError.code })
    return jsonResponse({ error: 'The account could not be deleted. Please try again.' }, 500, origin)
  }

  return jsonResponse({ success: true }, 200, origin)
}
