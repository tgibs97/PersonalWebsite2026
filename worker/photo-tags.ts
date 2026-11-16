/*
 * How a share link's Description says what to do with it. Kept apart from photos.ts so it can be tested alone.
 *
 *   [site]                          show this link in the Photos app
 *   [private] / [members] / [hidden]  ...but hide it from Guests
 *
 * Brackets can be [ ], ( ) or { }, in any case, with spaces inside. A typo in a *private* tag would show a
 * private album to everyone who passes the bot check, so the private tag is read generously and anything
 * that merely looks like one counts: private wins every doubt.
 */

const OPEN = String.raw`[\[({]`
const CLOSE = String.raw`[\])}]`

const tag = (words: string, flags = 'i') => new RegExp(`${OPEN}\\s*(?:${words})\\s*${CLOSE}`, flags)

const SITE = tag('site')
const PRIVATE = tag('private|privat|members?|hidden')
const ANY = tag('site|private|privat|members?|hidden', 'gi')

export interface Tags {
  /** Show this link on the site at all. */
  site: boolean
  /** Hide it from Guests. */
  private: boolean
  /** What's left of the description once the tags are taken out: the album's title. */
  title: string
}

export function readTags(description: string | null | undefined): Tags {
  const text = description ?? ''
  return {
    site: SITE.test(text),
    private: PRIVATE.test(text),
    title: text.replace(ANY, ' ').replace(/\s+/g, ' ').trim(),
  }
}
