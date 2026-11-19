# Personal Website 2026

A personal site styled as a Windows XP desktop. The homepage is the desktop; every page is an "app" that opens in a draggable window and also has its own URL (`/about`, `/projects`, ...). Before anyone sees it, they pass an XP-style log-on screen backed by Cloudflare Turnstile, which keeps bots and AI crawlers out.

**Stack:** React 19 + Vite + TypeScript, hosted on a Cloudflare Worker with Static Assets (SPA fallback).

```bash
npm run dev      # local dev server (runs through the Cloudflare Vite plugin)
npm run build    # type-check + production build into dist/
npm run preview  # serve the production build locally, in workerd
npm run types    # regenerate worker-configuration.d.ts after changing wrangler.jsonc / .dev.vars.example
npm run deploy   # build, then wrangler deploy
```

## The log-on gate

The gate is enforced **in the Worker**, not in the browser. A login screen that only exists in client-side JavaScript wouldn't stop a bot: it can fetch your HTML and JS directly.

`wrangler.jsonc` sets `run_worker_first`, so `worker/index.ts` sees every request before any file is served:

| Request | Without a session cookie | With a valid session cookie |
| --- | --- | --- |
| Any page (`/`, `/about`, ...) | `401` + the XP log-on page (`noindex`) | The desktop |
| The desktop bundle (`/assets/*`) and any other file | `401` | Served |
| `/login-assets/*`, `/robots.txt`, `/favicon.svg` | Served | Served |
| `POST /api/logon` | Verifies the Turnstile token, sets the cookie | Same |
| `POST /api/logoff` (Start menu, Log Off) | Clears the cookie | Same |

- **Turnstile check:** the log-on screen renders the widget; the Worker sends the token to Cloudflare's `siteverify` and requires `success`, the `logon` action, and a matching hostname (`worker/turnstile.ts`). Any failure rejects the log-on.
- **Users:** the log-on screen offers Trent, Family & Friends, and Guests (`worker/users.ts`). Guests are logged on by the bot check alone. For Trent and Family & Friends, passing the bot check only earns a 5-minute pass (`xp_pass`, tied to that user); the screen then asks for the password, which the Worker checks against the `PASSWORD_TRENT` / `PASSWORD_FAMILY` secret in constant time before issuing the session.
- **Session:** a stateless cookie recording the user, `<expiry>.<user>.<HMAC-SHA256>`, `HttpOnly`, `SameSite=Lax`, valid 24 hours (`worker/session.ts`). Nothing is stored server-side. Changing `SESSION_SECRET` logs everyone off.
- **Fails closed:** if `TURNSTILE_SECRET_KEY` or `SESSION_SECRET` is missing, nobody can log on.
- **Two bundles:** `login.html` + `src/login/` is a tiny framework-free bundle that shares no code with the desktop, so `/login-assets/` is the only public build output. The desktop bundle stays behind the gate.
- **robots.txt:** asks well-behaved crawlers (including named AI bots) to stay out. The gate is what actually stops the rest.

### Local development

```bash
cp .dev.vars.example .dev.vars   # then put a random string in SESSION_SECRET (see the file)
npm run dev
```

`.dev.vars` (git-ignored) uses Cloudflare's published dummy Turnstile keys, which always pass, plus `TURNSTILE_TEST_MODE=true` so the Worker accepts their responses (dummy keys report no action and the hostname `example.com`). Test mode only takes effect when Cloudflare's reply confirms a testing key. Never set it in production.

The Wishlist's database and pictures run locally too (under `.wrangler/`, which is git-ignored). Create its tables once with `npm run db:migrate`, and again whenever a new file appears in `migrations/`.

### Going live

1. In the Cloudflare dashboard, go to **Turnstile → Add widget**. Choose **Managed** mode and add the hostname the site will run on (your custom domain, or the `*.workers.dev` host). Copy the **sitekey** and **secret**.
2. Put the sitekey in `vars.TURNSTILE_SITE_KEY` in `wrangler.jsonc` (it is public).
3. `npm run deploy`.
4. Create the storage the Wishlist uses (both are free at this size), and put the database id in `wrangler.jsonc`:
   ```bash
   npx wrangler d1 create tgos                # prints a database_id: paste it into d1_databases in wrangler.jsonc
   npx wrangler r2 bucket create tgos-images  # R2 may ask you to enable it (and add a payment method) in the dashboard first
   npm run db:migrate:remote                  # creates the Wishlist's tables
   ```
5. Set the secrets. The site fails closed (nobody can log on) until they exist:
   ```bash
   npx wrangler secret put TURNSTILE_SECRET_KEY    # the widget's secret
   npx wrangler secret put SESSION_SECRET          # any long random string
   npx wrangler secret put PASSWORD_TRENT          # the Trent user's password
   npx wrangler secret put PASSWORD_FAMILY         # the Family & Friends password
   npx wrangler secret put IMMICH_ACCESS_CLIENT_ID      # Photos: the tgos-site service token's Client ID
   npx wrangler secret put IMMICH_ACCESS_CLIENT_SECRET  # Photos: its Client Secret
   npx wrangler secret put IMMICH_API_KEY               # Photos: the read-only (sharedLink.read) Immich key
   ```
   Also add `"IMMICH_URL": "https://immich-origin.trentgibson.com"` to `vars` in `wrangler.jsonc` (it isn't secret). Until the Immich settings exist, the Photos window just says the photos can't be reached.
   Until a password secret is set, that user can't log on (Guests still can).
6. Optional: set `TURNSTILE_HOSTNAMES` (comma-separated) if the widget runs on a host other than the one serving the page. By default the Worker requires the token's hostname to equal the request host.

Cloudflare also offers dashboard-level bot controls (Security → Bots, and AI Crawl Control) that stack on top of this. They aren't configured by this repo.

## Adding an app (a new page)

1. Create the component in `src/apps/`, e.g. `Notes.tsx`.
2. Add an entry to `src/apps/registry.tsx` (`id`, `title`, `icon`, default `size`, `shortcut`, `component`).

That gives it a desktop icon, a Start menu entry, a window, and the URL `/<id>`, all behind the log-on gate. New icons go in `src/os/icons.tsx`.

### Members-only apps

Apps that Guests must not see (Wishlist, Cruise, Mothership) live in `src/apps/private/` instead, registered in `src/apps/private/registry.tsx` with their icons in `src/apps/private/icons.tsx`. That folder is built into its own file under `assets/private/`, which the desktop only loads for Trent and Family & Friends, and which the Worker refuses to a guest session (403). Nothing about these apps, not even their names, is in the main bundle that Guests download. Keep it that way: don't import anything from `src/apps/private/` outside that folder, except through `loadPrivateApps()`. A members-only app's stylesheet is imported with `?inline` (see `Wishlist.tsx`), so it travels inside that private file instead of becoming a separate public one.

## Rule: anything that waits shows a spinner

Wherever the site waits for something (a list loading, a save, an upload, a picture arriving, a refresh), a spinner shows. Never plain "Loading…" text or a silent blank. Use the shared pieces in `src/os/Spinner.tsx`:

- `<Spinner label="Saving…" />` is a ring with a label, for a button, a status bar or a line of text.
- `<Spinner block label="Loading…" />` is centred in the panel or window that is waiting as a whole.
- `<LoadingImage src=… />` is an `<img>` that shows a spinner until it arrives (put it in a box with `position: relative`).
- The log-on page can't share React components, so `showWaiting()` in `src/login/main.ts` draws the same ring.

The ring itself is `.xp-spin` in `src/styles/luna.css`. If the waiting space will hold a list, give it the list's height (see `.hs-panel`) so the window doesn't jump when the data arrives.

## Rule: everything works on a phone

The desktop look is the default, and phones get a layer on top of it that never touches the desktop's styles. Two questions, two kinds of media query (the full explanation is under "Small screens and touch" in `src/styles/luna.css`):

- **Is the screen small?** `(max-width: 700px)`. The layout changes: windows fill the screen (no dragging, resizing or maximize button), the desktop icons become a grid that fills any width, side-by-side panes stack. A phone held sideways is wide but short, so windows also fill the screen for `(pointer: coarse) and (max-height: 500px)`: that condition is `COMPACT_QUERY` in `src/os/windows.tsx` and has to match the CSS.
- **Is it touched?** `(pointer: coarse)`. Targets get finger-sized (taller taskbar and title bar, bigger buttons, checkboxes and resize edges) and text fields become 16px so iOS doesn't zoom in when one is focused. A tablet keeps the desktop layout but gets these.

Writing a new app so it works on every phone without extra effort:

- Size things with flex, grid and `min()` / `minmax()`, not fixed widths. Never give something a fixed width wider than about 300px without `max-width: 100%` or `min(…, 100%)`; a grid column like `minmax(380px, 1fr)` overflows a phone, `minmax(min(380px, 100%), 1fr)` doesn't.
- Anything side by side that wouldn't fit in 340px (a list beside an editor, a row of columns) goes in a `@media (max-width: 700px)` block at the bottom of the app's stylesheet that stacks or slims it. The Wishlist, Control Panel and Analytics stylesheets have one each to copy.
- Let a wide table scroll itself (`display: block; overflow-x: auto`, see `.an-table`) instead of being cut off.
- Small click targets (arrows, close dots, tabs) get a `@media (pointer: coarse)` block that makes them at least about 28px.
- Menus and popups that sit above the taskbar need a `max-height` using `dvh` and `overflow-y: auto`, so a long list scrolls instead of running off the screen.
- Use `var(--taskbar-h)` and `taskbarHeight()`, never 30: the taskbar is taller on touch screens. (There is deliberately no `viewport-fit=cover` and no safe-area padding: it made the taskbar a tall, oddly banded block on a real phone. Some phone browsers also keep a strip at the very bottom that no page can paint; it takes its colour from `theme-color` in `index.html`, set to the taskbar's bottom-edge colour.)

Check a new app at 375×812 and at 320×568, and at the normal desktop size to be sure nothing there changed.

## Layout

| Path | What lives there |
| --- | --- |
| `worker/` | The Cloudflare Worker: the gate (`index.ts`), session cookie (`session.ts`), Turnstile check (`turnstile.ts`), the Photos app's Immich proxy (`photos.ts`), the Wishlist's API (`wishlist.ts`), the site's analytics (`analytics.ts`) |
| `migrations/` | The database's tables (D1), applied with `npm run db:migrate` |
| `src/apps/admin/` | Admin-only apps (Trent's Analytics), built into their own file the Worker keeps from everyone else |
| `login.html`, `src/login/` | The XP log-on screen: standalone, framework-free, and public |
| `src/os/` | The "operating system": window manager (`windows.tsx`), `Window`, `Taskbar`, `StartMenu`, `Desktop`, `Wallpaper`, `icons` |
| `src/apps/` | The site's pages, one component each, registered in `registry.tsx` |
| `src/os/wallpaper/` | The monthly wallpaper themes and their scenery (see below) |
| `src/apps/browser/` | A reusable make-believe web browser (start page of shortcuts, tabs, address bar); the Letterboxd app is built on it |
| `src/styles/browser.css` | The browser's XP Internet Explorer look |
| `src/styles/luna.css` | The XP Luna theme (title bars, taskbar, Start menu) |
| `src/styles/wallpaper.css` | Wallpaper layout and every wallpaper animation |
| `src/site.ts` | Owner name and site title. The log-on screen's `<title>` is separate, in `login.html` |
| `design/logo-build/` | Builds the tgOS logo and writes it into the favicon, Start button and log-on screen (see below) |
| `design/logos/` | Logo explorations, plus the finished SVGs in `final/` |
| `wrangler.jsonc` | Cloudflare config: assets, the gate, vars, observability |
| `worker-configuration.d.ts` | Generated by `npm run types`. Don't edit by hand |

The wallpaper, icons and logo are original SVG artwork, not Microsoft assets.

## The browser app

`src/apps/browser/Browser.tsx` is a small make-believe web browser in the style of XP's Internet Explorer: a start page of shortcut tiles inside browser chrome (address bar, a tab, a status bar). Each tile is a real link that opens the real address in a new tab of the visitor's own browser, and hovering one shows its address in the status bar. To make another browser-style app, give it a list of shortcuts, as `src/apps/Letterboxd.tsx` does.

Nothing is loaded inside the fake browser: sites like Letterboxd send `X-Frame-Options: SAMEORIGIN` and so refuse to be shown inside other sites.

## Analytics

Trent's **Analytics** window (`src/apps/admin/Analytics.tsx`, admin-only) shows where visitors go and who keeps coming back, so repeat visitors and abuse are easy to spot. Nothing goes to a third party and nothing is loaded from another domain: the page tells this site's own Worker what happens (`POST /api/desk`, a plain path no filter list has heard of), and the Worker (`worker/analytics.ts`) stores it in the D1 database. Ad blockers and privacy browsers act on tracker domains and well-known tracker URLs, so a note to the site's own address generally gets through. Nothing can be promised against someone who blocks that exact URL by hand, or has JavaScript off (though the Worker still sees their log-on and page load).

**What is recorded, on purpose:** the visitor's IP address, country, region, city and network (e.g. "Comcast" or "DigitalOcean") from Cloudflare, their raw browser string (and a tidied browser/OS/device), and a long-lived **visitor id** (the `xp_vid` cookie, HttpOnly, one year, sent on the log-on screen) so the same browser is recognised between visits and across different IP addresses. And what they did: windows opened and closed (with seconds), links followed out of the Letterboxd shortcuts, Photos albums and photos looked at, Paper Toss runs (difficulty and streak), when the site was left, and every log-on that got as far as a password (including wrong ones, with the IP). Log-on screen views and bot-check results are kept as daily totals only, so bots can't flood the database; they are written about 20 seconds after they happen (the Worker holds them briefly, then flushes them on a timer), so the funnel can lag by that much.

**What is never recorded:** anything about the Wishlist and the Analytics window (so Trent can't be spoiled, and an admin tab can't leak into a guest's visit), and Trent's own visits (only wrong passwords against his account are noted). The log-on screen carries no notice about any of this, at Trent's choice.

**The window.** Choose the time (today to the last year) and who (Guests, Family & Friends, or both; it starts on Guests). *Overview*: visits, visitors, how many came back, average visit, a per-day chart, the log-on funnel, the most opened windows with average time, links followed, Paper Toss and albums. *Visitors*: one row per browser with its IP, place, network, browser, **time on site** and a "worth a look" column (4 or more IP addresses, 3 or more wrong passwords, a very busy visit, looks like a bot). Because a visitor is one browser's cookie, the same person in a private window, another profile, or after clearing cookies shows up as a new visitor. So when another visitor id has been on the same IP address with the same browser and system, the row gets a blue **probably the same person as …** chip that opens that visitor. Visitors on the same IP with a *different* browser get a plain "shares its IP with N other visitors (different browser)" note instead (a neighbour or housemate, more likely). These are guesses, never merges: a household or office can put different people on one IP with the same browser. Click a row for every visit it made, with a time-stamped trail of what it did, and the other visitor ids seen on the same IP addresses, each marked "same browser" or "different browser". *Sign-ins*: wrong passwords grouped by IP, and each attempt.

**Time on site** adds up the time between a visitor's moves (opening a window, closing one, following a link, leaving), and leaves out any quiet stretch of over 10 minutes (`IDLE_GAP_MS` in `worker/analytics.ts`), because a visit is a whole log-on session of up to 24 hours: a tab left open, or a visitor returning hours later, would otherwise look like hours on the site. The time before the first move and after the last one isn't counted, so it's slightly low rather than high. The Overview's "average visit" and each visit's length in the visitor detail use the same measure.

**Limits and housekeeping.** Raw rows are deleted after 365 days (`KEEP_DAYS` in `worker/analytics.ts`). One visit keeps at most 3,000 moves. The Worker accepts only the shapes it expects (an app id must look like an app id, an album a UUID, a link must be `http(s)`), so a visitor can't fill the dashboard with made-up names, and every write needs a same-site `Origin`. `request.cf` (country, city, network) is only filled in on the live site; locally the town shown is Cloudflare's guess for your own connection. The tables are created by `migrations/0003_analytics.sql` (`npm run db:migrate`, and `db:migrate:remote` before deploying).

**Admin-only apps** live in `src/apps/admin/`, built into `assets/admin/`, which the Worker refuses to everyone except Trent (and the desktop only asks for them when `/api/whoami` says `admin`). They are separate from the members-only apps, which Family & Friends can also open.

## Control Panel (Trent only)

An admin-only app (`src/apps/admin/ControlPanel.tsx`, built into `assets/admin/` like Analytics) that lists every other app with a checkbox for each user: Guests, Family & Friends and Trent. Untick one and that user no longer gets the app: its desktop icon, Start menu entry and address are gone, and its API (Photos, Wishlist, Paper Toss scores) answers 404 to them. Trent can untick himself too. Guests never get the members-only apps, and only Trent gets his own (Analytics), so those boxes are greyed out. Clicking a column heading ticks or unticks the whole column. The Control Panel itself isn't listed and can't be switched off, so Trent can always get back in.

- Switches live in the D1 table `app_access` (`migrations/0006_app_access.sql`; one row per app and user, and no row means on). Run `npm run db:migrate` (and `db:migrate:remote` when deploying).
- `GET /api/controls` and `PUT /api/controls/apps` (`worker/controls.ts`) are Trent-only. `/api/whoami` tells each user which apps are off for them, and the desktop drops them as it loads.
- Enforced by the Worker, not just the desktop: each user's list is checked on every call to an app's API. A change shows up in someone's desktop the next time their page loads, and their API calls are refused within about 10 seconds.
- What a switch can't do: an app's pages and text that ship inside the site's JavaScript (About Me, Projects, Cruise and so on) are hidden, not secret. Anything that must be secret has to come from an API (as Photos and the Wishlist do).
- The `API_OWNERS` list in `worker/controls.ts` maps each app's API to the app. Add a line there when a new app gets an API of its own.

## Wishlist

`src/apps/private/Wishlist.tsx` (members-only) with its API in `worker/wishlist.ts`. Items live in a D1 database and their pictures in an R2 bucket; both are free at this size.

**Trent** gets a manager: his items on the left (drag a row by its dotted grip to move it anywhere: an orange bar shows where it will land, the list scrolls itself near its edges, and a finger works too; the ▲▼ arrows still move one place, for the keyboard), an editor on the right with the item's name, **MSRP**, **expected price**, an optional **don't pay over** limit (family see it on the card as "Please don't pay over $X"), any number of **links** (store name and web address), **notes**, and up to eight **pictures**. Pictures are shrunk to 1600 px and re-drawn as JPEGs in the browser before they're sent (which also drops hidden details such as where a photo was taken), and the Worker checks the file's real type from its first bytes. Links must be plain `http(s)` addresses.

**Family & Friends** get gift cards for the same items, each with an **I bought this** button. They type their name, and everyone else then sees "Bought by Aunt Sue", so nobody doubles up and people can split costs. Two people pressing at the same instant can't both win (the database allows one buyer per item). Anyone in Family & Friends can undo a purchase after a confirmation, so a mistake or a lost browser is never stuck. Guests see and can do nothing: the whole API is members-only.

**The surprise.** Trent must not learn what has been bought, so the Worker (not the page) never sends him purchases, not even a "bought" flag: his list is built from a query that doesn't touch the purchases table. A purchase doesn't touch the item's row either, so not even its last-changed time moves, and the Worker logs nothing about purchases. Trent's login can't claim anything. Once the occasion is over he can press **Reveal purchases** (it warns him first) to see who bought what; while it's on, Family & Friends see a notice that he can. **Hide purchases** turns it back off. This protects the surprise from the app, not from Trent's own determination: he owns the Cloudflare account (so he could read the database or logs directly, so avoid opening the D1 tables), and he knows the Family & Friends password.

Writes are Trent-only, need a same-site `Origin`, and are validated on the Worker whatever the page checked. Pictures are served only to members, with headers that stop them acting as web pages. The tests for all of this (who may call what, the byte-for-byte check that Trent's list doesn't change when something is bought, two people claiming at once, twelve pictures uploaded at once) were run against the dev server; ask for them to be added to the repo if you want them kept.

## Photos (from Immich)

The Photos app shows albums from Trent's Immich server, which runs at home on TrueNAS. The browser never talks to Immich: the Worker (`worker/photos.ts`) does, and the window (`src/apps/Photos.tsx`) only ever sees album and photo ids and loads images from `/api/photos/...` on the site itself.

**Putting photos on the site happens entirely in Immich.** Make a share link (of an album, or of hand-picked photos) and put `[site]` in its **Description**. Add `[private]` as well to hide it from Guests: for them it looks exactly like an album that doesn't exist. (`[members]` and `[hidden]` mean the same. Brackets can be `[ ]`, `( )` or `{ }`, in any case, with spaces inside, and a misspelling like `[privat]` still counts, because a typo in a private tag would otherwise show a private album to everyone.) The rest of the description becomes the album's title on the site; with none, the Immich album name is used. Links without `[site]` never appear. Changes show up within a minute. Private albums are labelled "private" in the window, so you can see at a glance that the tag was read.

**A Guest is anyone who passes the bot check, so an album without `[private]` is effectively public.** Only leave `[private]` off for photos you'd be happy for any stranger to see.

Recommended link settings: expire **Never** (an expired link drops off the site), no password, downloads **off** (the site only needs previews), uploads **off**, metadata **off** (it can include GPS). A Custom URL isn't needed.

**How the Worker reaches a home server.** Immich isn't on the internet. A dedicated Cloudflare Tunnel (its own Cloudflared app on TrueNAS, separate from the other tunnels there) publishes it at `immich-origin.trentgibson.com`, and Cloudflare Access locks that hostname to one service token (`tgos-site`) with a single Service Auth policy; the route also checks the Access token itself ("Protect with Access"). Only the Worker holds the token, so anyone else, browsers included, gets a 403. The Worker lists links with an Immich API key that has only the `sharedLink.read` permission, and reads each album's photos with that link's own share key, so Immich itself limits every request to that link's photos.

Images are proxied and kept in Cloudflare's cache for a week (in the browser for a day), so repeat views don't reach the home server. The list of links and each album's contents are reused for a minute. Videos stream through with seeking support.

**Security notes** (all in `worker/photos.ts`):
- Every `/api/photos` request needs a valid session, and an album is checked against the visitor's audience before anything is fetched or served from cache. Cross-site requests (`Sec-Fetch-Site: cross-site`) are refused.
- Nothing from Immich is trusted: ids must be UUIDs, an image must really be an image type (JPEG, WebP, PNG, AVIF or GIF) and a video a `video/*` type, and sizes are capped (50 links, 5,000 photos and 120 months per album). Images and video are sent with `nosniff`, a locked-down Content-Security-Policy and `Cross-Origin-Resource-Policy: same-origin`, so they can never act as a page.
- Redirects from Immich are never followed (the Access token must not follow one to another host), `IMMICH_URL` must be `https`, and share keys never appear in logs or error messages.
- A crowd of visitors shares one request to the home server (and a failure is remembered for 5 seconds), so the site can't be used to flood it. Album contents are read at most 6 months at a time. An album spanning more than about 45 months needs the Workers Paid plan (the free plan allows 50 subrequests per request).
- Cloudflare's own rate limiting (Security → WAF → Rate limiting rules) can sit on top of this for `/api/photos/*`; it isn't configured by this repo.

Locally, the same settings go in `.dev.vars` (`IMMICH_URL`, `IMMICH_ACCESS_CLIENT_ID`, `IMMICH_ACCESS_CLIENT_SECRET`, `IMMICH_API_KEY`; see `.dev.vars.example`), and restart the dev server after changing them.

## Paper Toss (the Recycle Bin)

The Recycle Bin is a game, in `src/apps/paper-toss/PaperToss.tsx`: swipe up anywhere in the window to throw a desktop icon into the bin. The bin moves after every basket, and a miss ends the run. Physics constants sit at the top of the file.

**Missing before you've scored anything** doesn't end anything: after a short beat the next throw is served, with no message. The "Missed!" box (and the leaderboard screens) only appear when a run ends after at least one basket.

**The leaderboard.** A **High Scores** window for each difficulty (a top ten of the longest streaks, one XP tab per difficulty), opened from the **High scores** button in the game's top bar or from the "Missed!" box. When a run ends high enough to earn a place, an XP message box appears: "You got 2 in a row… That's 2nd place on the board", with a box for three initials and OK / Skip. After saving, the list opens with your entry selected. Everyone who is logged on can play for it, Guests included. Entries are only the three initials, the streak and the date. Ties go to the earlier score. The code is `src/apps/paper-toss/Leaderboard.tsx` and `arcade.ts`, and `worker/arcade.ts` on the server (tables from `migrations/0004_arcade.sql`). Both screens reuse the site's XP window frame, title bar and buttons, so they look like the rest of the desktop. The board is fetched when a run's first throw is made (together with the run token), so when the run ends the New High Score box can appear straight away without waiting for the network; the Worker still checks the score when it's handed in, and says so if the board changed in the meantime.

The score comes from the player's own browser, so it can't be fully trusted; cheating is made awkward rather than impossible (`worker/arcade-rules.ts`):
- A run gets a **signed run token** from the Worker when its first throw is made. A score needs one, for the same difficulty, and it works **once**.
- Enough real time must have passed to throw that many baskets (1.4 seconds each, `MIN_MS_PER_BASKET`), so a quick `POST` of "streak 500" is refused. Streaks over 500 are never believed.
- **One browser can hold at most three places** on a board (by its visitor cookie); past that it has to beat its own lowest to replace it.
- Initials must be exactly three letters or digits, and a short list of rude combinations is refused (without using up the run).
- Writes need a same-site `Origin`, and a score that doesn't make the top ten isn't kept.

Anything that slips through shows up in Trent's Analytics window (every run is recorded there), and **Trent sees a Remove button on each row** to delete an entry.

What you throw is a parody desktop icon (33 of them), picked at random each throw and never the same one twice in a row: XP-era files and apps ("Final_FINAL_v3.doc", "DO_NOT_DELETE.zip", "Internet Diver"), parodies of modern apps ("Steem", "Photoslop.exe"), PC parts ("CPU (Overclocked)", "RAM", "Power Supply") and "System32". Its name sits above it like a selected desktop icon's label. They live in `src/apps/paper-toss/items.ts` as original 64x64 SVGs, so adding one is one more `{ name, svg }` entry. The art is only drawn over the throw: every icon flies and bounces as the same circle (`BALL_R`), so which one you get never changes the difficulty.

There are two difficulties, switched from the buttons in the game's top bar (switching starts a fresh run):

- **Baby's First Video Game** (the default): no wind, and the throw is aimed rather than flicked. How far and which way you drag from where you pressed sets the throw (`AIM_POWER`), so you can take your time with a mouse. While you drag, a dotted line shows the path the throw will take, fading out with distance. Letting go throws exactly what the line shows, and dragging back to where you started cancels the throw.
- **Dark Souls**: the original game. The throw comes from how fast you flick, each throw has a random wind, and the wind grows with your streak.

Each difficulty keeps its own best streak, in the player's own browser (localStorage keys `tgos-paper-toss-best-baby` and `tgos-paper-toss-best`) and nowhere else.

## Monthly wallpaper

The grass hill changes with the calendar month (Northern-Hemisphere seasons), each with a little scenery and slow, quiet motion:

| Month | Theme | What moves |
| --- | --- | --- |
| Jan | Snowfall | Snow drifting down |
| Feb | Northern Lights | Aurora ribbons swaying, stars twinkling |
| Mar | Spring Showers | A rainbow fading in and out, faint rain |
| Apr | Cherry Blossoms | Petals drifting |
| May | Wildflowers | Butterflies |
| Jun | Summer Sun | Sun rays turning, floating pollen |
| Jul | Fireworks Night | Multicolour fireworks (up to three or four at once, in drifting clusters), twinkling stars, fireflies, an American flag rippling on the hill |
| Aug | Golden Hour | Hot-air balloons, fireflies |
| Sep | Early Autumn | Falling leaves, a flock of geese |
| Oct | Harvest Moon | Flickering pumpkins, bats |
| Nov | Golden Harvest | Drifting golden haze, a turkey pecking at the grass, plenty of falling leaves, with hay bales and a low sun |
| Dec | Winter Night | Santa's sleigh crossing the sky, a tree with twinkling lights, snow |

The theme follows the visitor's own calendar date: it is chosen when the page loads, and a page left open updates itself at midnight (and when a sleeping tab wakes up), so it flips on the 1st with no deploy or reload.

Visitors can click the clock in the taskbar to pick any month's theme (or "Follow today's date"). The pick is held in memory only, in `src/os/wallpaper/month.ts`: it is never written to localStorage, a cookie or the address bar, so refreshing the page always returns to today's theme. Adding `?month=10` (or `?month=oct`) to the address just sets the starting pick.

Each month is one entry in `src/os/wallpaper/themes.tsx` (palette, plus scenery and weather built from the pieces in `scenery.tsx`, `movers.tsx` and `particles.tsx`). Edit an entry to retune a month, or add scenery with `onHill(x, depth)` to stand it on the hill. Motion is kept calm on purpose: only `transform` and `opacity` animate, and everything switches off for visitors who have "reduce motion" turned on.

## The tgOS logo

The logo is the "Orbit" mark (a blue sphere with an orange ring, holding "tg") followed by an orange "OS" at the same size, so the pair reads "tgOS" once. Its lettering is outlined from Franklin Gothic Medium Italic, so it looks the same on every device. To change colors, sizes or proportions, edit `design/logo-build/build.mjs` and run:

```bash
node design/logo-build/build.mjs
```

That rewrites `public/favicon.svg`, `src/os/logo-art.tsx` (the Start button icon), the logo block in `login.html`, and `design/logos/final/*.svg`. Don't edit those by hand. `glyphs.json` holds the letter outlines; `outline-text.py` (needs Python with `fontTools`, and the font installed) regenerates it if the lettering changes.
