import './login.css'

/**
 * The XP log-on screen. Click a user (Trent, Family & Friends or Guests), pass a Turnstile check, and the Worker hands back a
 * session cookie; then the page reloads and the Worker serves the desktop instead of this screen.
 * The check is enforced server-side (worker/index.ts): this script only drives the UI.
 */

const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
/** Must match LOGON_ACTION in worker/turnstile.ts. */
const LOGON_ACTION = 'logon'
/** How long the "welcome" splash shows before the desktop loads. */
const WELCOME_MS = 1400

type State = 'idle' | 'challenge' | 'verifying' | 'password' | 'welcome'

interface TurnstileApi {
  render(
    container: string | HTMLElement,
    options: {
      sitekey: string
      action: string
      theme: 'light' | 'dark' | 'auto'
      callback: (token: string) => void
      'error-callback': () => void
      'expired-callback': () => void
    },
  ): string
  reset(widgetId: string): void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id)
  if (!found) throw new Error(`Missing #${id}`)
  return found as T
}

const root = el('logon')
const status = el('status')

/** The site-wide rule: anything waited for shows a spinner (this page can't share the desktop's component, so it draws the same ring). */
function showWaiting(text: string) {
  const ring = document.createElement('i')
  ring.className = 'spin'
  ring.setAttribute('aria-hidden', 'true')
  status.replaceChildren(ring, text)
}
const balloon = el('balloon')
const balloonText = el('balloon-text')
const powerOff = el('power-off')
const powerOn = el('power-on')
const prompt = el('card-prompt')
const passwordForm = el<HTMLFormElement>('password-form')
const passwordInput = el<HTMLInputElement>('password-input')
const passwordUser = el<HTMLInputElement>('password-user')

/** Which tile was picked: its id goes to the Worker, which decides whether a password is needed. */
let chosenUser = 'guests'

const sitekey = document.querySelector<HTMLMetaElement>('meta[name="turnstile-sitekey"]')?.content ?? ''

const setState = (state: State) => {
  root.dataset.state = state
}

function showError(message: string) {
  balloonText.textContent = message
  balloon.dataset.visible = 'true'
}

function clearError() {
  delete balloon.dataset.visible
}

let widgetId: string | null = null
let turnstileLoaded: Promise<void> | null = null

function loadTurnstile(): Promise<void> {
  turnstileLoaded ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = TURNSTILE_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      script.remove()
      turnstileLoaded = null // let a retry try again
      reject(new Error('Turnstile failed to load'))
    }
    document.head.append(script)
  })
  return turnstileLoaded
}

function resetWidget() {
  if (widgetId !== null) window.turnstile?.reset(widgetId)
}

function retry(message: string) {
  setState('challenge')
  status.textContent = ''
  showError(message)
  resetWidget()
}

async function logOn(token: string) {
  setState('verifying')
  clearError()
  showWaiting('Logging on…')

  try {
    const response = await fetch('/api/logon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ token, user: chosenUser }),
    })
    if (response.ok && ((await response.json()) as { next?: string }).next === 'password') {
      askForPassword()
      return
    }
    if (!response.ok) {
      retry(
        response.status === 500
          ? "Logging on isn't available right now. Please try again later."
          : "We couldn't confirm that you're human. Please try again.",
      )
      return
    }
  } catch {
    retry('The connection was interrupted. Please try again.')
    return
  }

  welcome()
}

function welcome() {
  setState('welcome')
  window.setTimeout(() => window.location.reload(), WELCOME_MS)
}

/** The bot check passed for a user with a password: swap the widget for a password box. */
function askForPassword() {
  root.dataset.step = 'password'
  setState('password')
  status.textContent = ''
  prompt.textContent = 'Type your password'
  passwordInput.value = ''
  passwordInput.focus()
}

async function submitPassword(password: string) {
  setState('verifying')
  clearError()
  showWaiting('Logging on…')
  try {
    const response = await fetch('/api/logon/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ password }),
    })
    if (response.ok) {
      welcome()
      return
    }
    if (response.status === 401) {
      // The five-minute pass ran out: run the bot check again.
      prompt.textContent = "Prove you're human to log on"
      showError('That took a while, so the security check expired. Please complete it again.')
      void begin(false)
      return
    }
    askForPassword()
    showError(
      response.status === 403
        ? 'Did you forget your password? Please type your password again.'
        : "Logging on isn't available right now. Please try again later.",
    )
  } catch {
    askForPassword()
    showError('The connection was interrupted. Please try again.')
  }
}

async function begin(clear = true) {
  root.dataset.step = 'bot'
  setState('challenge')
  prompt.textContent = "Prove you're human to log on"
  if (clear) clearError()

  if (!sitekey || sitekey.startsWith('REPLACE_')) {
    status.textContent = ''
    showError('This site has no Turnstile sitekey configured yet, so no one can log on.')
    return
  }

  showWaiting('Checking that you are human…')
  try {
    await loadTurnstile()
  } catch {
    status.textContent = ''
    showError('The security check could not be loaded. Check your connection, then pick your user again.')
    return
  }

  if (widgetId !== null) {
    resetWidget()
    return
  }
  widgetId =
    window.turnstile?.render('#turnstile', {
      sitekey,
      action: LOGON_ACTION,
      theme: 'light',
      callback: (token) => void logOn(token),
      'error-callback': () => retry('The security check ran into a problem. Please try again.'),
      'expired-callback': () => retry('The security check expired. Please try again.'),
    }) ?? null
}

const cardName = el('card-name')
const cardAvatar = document.getElementById('card-avatar')

// Every user goes through the same check for now; the card just shows who was picked.
for (const tile of document.querySelectorAll<HTMLButtonElement>('.user-tile')) {
  tile.addEventListener('click', () => {
    chosenUser = tile.dataset.id ?? 'guests'
    cardName.textContent = tile.dataset.user ?? ''
    passwordUser.value = tile.dataset.user ?? ''
    cardAvatar?.setAttribute('href', `#${tile.dataset.avatar}`)
    void begin()
  })
}

passwordForm.addEventListener('submit', (e) => {
  e.preventDefault()
  if (passwordInput.value) void submitPassword(passwordInput.value)
})

el('card-back').addEventListener('click', () => {
  clearError()
  status.textContent = ''
  setState('idle')
})

el('turn-off').addEventListener('click', () => {
  powerOff.hidden = false
  powerOn.focus()
})
// Only the power button turns the computer back on: clicking the black screen does nothing.
powerOn.addEventListener('click', () => {
  powerOff.hidden = true
  el('turn-off').focus()
})
