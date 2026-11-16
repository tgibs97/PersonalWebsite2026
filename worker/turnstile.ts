const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/** The widget on the log-on screen declares this action; siteverify must echo it back. */
export const LOGON_ACTION = 'logon'

/** Tokens are at most 2048 characters per Cloudflare's docs. */
export const MAX_TOKEN_LENGTH = 2048

interface SiteverifyResponse {
  success: boolean
  action?: string
  hostname?: string
  'error-codes'?: string[]
  metadata?: { result_with_testing_key?: boolean }
}

export type TurnstileOutcome = { ok: true } | { ok: false; reason: string }

const fail = (reason: string): TurnstileOutcome => ({ ok: false, reason })

/**
 * Server-side Turnstile validation. Fails closed: a network error, a non-JSON reply, `success: false`,
 * or a token minted for a different action or hostname all reject the request.
 */
export async function verifyTurnstile(token: string, request: Request, env: Env): Promise<TurnstileOutcome> {
  let result: SiteverifyResponse
  try {
    const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token })
    const ip = request.headers.get('CF-Connecting-IP')
    if (ip) body.set('remoteip', ip)

    const response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) return fail(`siteverify_http_${response.status}`)
    result = await response.json<SiteverifyResponse>()
  } catch {
    return fail('siteverify_unreachable')
  }

  if (result.success !== true) return fail(`rejected:${(result['error-codes'] ?? []).join(',')}`)

  // Cloudflare's dummy keys can't echo an action or a real hostname. Relax the checks only when the
  // flag is set AND siteverify itself confirms a testing key, so a stray flag can't weaken a real secret.
  if (env.TURNSTILE_TEST_MODE === 'true' && result.metadata?.result_with_testing_key === true) {
    return { ok: true }
  }

  if (result.action !== LOGON_ACTION) return fail('wrong_action')

  const allowedHostnames = env.TURNSTILE_HOSTNAMES
    ? env.TURNSTILE_HOSTNAMES.split(',').map((h) => h.trim()).filter(Boolean)
    : [new URL(request.url).hostname]
  if (!result.hostname || !allowedHostnames.includes(result.hostname)) return fail('wrong_hostname')

  return { ok: true }
}
