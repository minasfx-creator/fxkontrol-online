import { createClient } from 'npm:@supabase/supabase-js@2'
import { handleCors, buildCorsHeaders } from '../_shared/cors'

Deno.serve(async (req) => {
  // Handle CORS preflight using runtime-configured allowed origins
  const preflight = handleCors(req)
  if (preflight) return preflight

  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    const headers = buildCorsHeaders(req)
    return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } })
  }

  // Extract token from query params (GET) or body (POST)
  const url = new URL(req.url)
  let token: string | null = url.searchParams.get('token')

  if (req.method === 'POST') {
    // Detect RFC 8058 one-click unsubscribe: POST with form-encoded body
    // containing "List-Unsubscribe=One-Click". Email clients (Gmail, Apple Mail,
    // etc.) send this when the user clicks "Unsubscribe" in the mail UI.
    const contentType = req.headers.get('content-type') ?? ''
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formText = await req.text()
      const params = new URLSearchParams(formText)
      // For one-click, token comes from query param (already set above).
      // Otherwise, token may be in the form body.
      if (!params.get('List-Unsubscribe')) {
        const formToken = params.get('token')
        if (formToken) {
          token = formToken
        }
      }
    } else {
      // JSON body (from the app's unsubscribe page)
      try {
        const body = await req.json()
        if (body.token) {
          token = body.token
        }
      } catch {
        // Fall through — token stays from query param
      }
    }
  }

  if (!token) {
    return jsonResponse({ error: 'Token is required' }, 400)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Look up the token
  const { data: tokenRecord, error: lookupError } = await supabase
    .from('email_unsubscribe_tokens')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  if (lookupError || !tokenRecord) {
    const headers = buildCorsHeaders(req)
    return new Response(JSON.stringify({ error: 'Invalid or expired token' }), { status: 404, headers: { ...headers, 'Content-Type': 'application/json' } })
  }

  if (tokenRecord.used_at) {
    return jsonResponse({ valid: false, reason: 'already_unsubscribed' })
  }

  // GET: Validate token (the app's unsubscribe page calls this on load)
  if (req.method === 'GET') {
    const headers = buildCorsHeaders(req)
    return new Response(JSON.stringify({ valid: true }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } })
  }

  // POST: Process the unsubscribe
  // Atomic check-and-update to avoid TOCTOU race
  const { data: updated, error: updateError } = await supabase
    .from('email_unsubscribe_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token', token)
    .is('used_at', null)
    .select()
    .maybeSingle()

  if (updateError) {
    console.error('Failed to mark token as used', { error: updateError })
    const headers = buildCorsHeaders(req)
    return new Response(JSON.stringify({ error: 'Failed to process unsubscribe' }), { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } })
  }

  if (!updated) {
    return jsonResponse({ success: false, reason: 'already_unsubscribed' })
  }

  // Add email to suppressed list (upsert to handle duplicates)
  const { error: suppressError } = await supabase
    .from('suppressed_emails')
    .upsert(
      { email: tokenRecord.email.toLowerCase(), reason: 'unsubscribe' },
      { onConflict: 'email' },
    )

  if (suppressError) {
    console.error('Failed to suppress email', { error: suppressError })
    const headers = buildCorsHeaders(req)
    return new Response(JSON.stringify({ error: 'Failed to process unsubscribe' }), { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } })
  }

  // Successful unsubscribe — avoid logging user email in plaintext
  console.log('Email unsubscribed')

  const headers = buildCorsHeaders(req)
  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } })
})
