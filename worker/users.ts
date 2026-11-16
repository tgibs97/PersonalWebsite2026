/**
 * Who can log on. Ids must match the `data-id` of the tiles in login.html.
 * A user with a `passwordVar` must type the password held in that Worker secret after passing the bot
 * check; a user without one is logged on by the bot check alone.
 */
export const USERS = {
  trent: { name: 'Trent', passwordVar: 'PASSWORD_TRENT', members: true, admin: true },
  family: { name: 'Family & Friends', passwordVar: 'PASSWORD_FAMILY', members: true },
  guests: { name: 'Guests', members: false },
} as const satisfies Record<string, { name: string; passwordVar?: 'PASSWORD_TRENT' | 'PASSWORD_FAMILY'; members: boolean; admin?: boolean }>

export type UserId = keyof typeof USERS

export const isUserId = (value: unknown): value is UserId => typeof value === 'string' && Object.hasOwn(USERS, value)

/** The secret holding this user's password, or null if the user has none. */
export function passwordVar(user: UserId): 'PASSWORD_TRENT' | 'PASSWORD_FAMILY' | null {
  const entry: { name: string; members: boolean; admin?: boolean; passwordVar?: 'PASSWORD_TRENT' | 'PASSWORD_FAMILY' } = USERS[user]
  return entry.passwordVar ?? null
}

const encoder = new TextEncoder()

/**
 * Compares a typed password with the real one in constant time. Both are first reduced to an HMAC digest
 * (so they are the same length, and the comparison leaks nothing about either), then compared with the
 * Workers runtime's timingSafeEqual.
 */
export async function passwordMatches(typed: string, actual: string, key: string): Promise<boolean> {
  const hmacKey = await crypto.subtle.importKey('raw', encoder.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const [a, b] = await Promise.all([
    crypto.subtle.sign('HMAC', hmacKey, encoder.encode(typed)),
    crypto.subtle.sign('HMAC', hmacKey, encoder.encode(actual)),
  ])
  return crypto.subtle.timingSafeEqual(a, b)
}

/** Members (Trent, Family & Friends) can use the members-only apps; Guests can't. */
export const isMember = (user: UserId): boolean => USERS[user].members

/** The site's owner: the only user who can edit the Wishlist. (He is also the one who must not see who bought what.) */
export const isAdmin = (user: UserId): boolean => ('admin' in USERS[user] ? USERS[user].admin === true : false)
