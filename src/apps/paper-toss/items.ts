/*
 * What gets thrown in Paper Toss: parody desktop icons, one picked at random for each throw. All the art is
 * original (64x64 SVG, drawn in the style of the XP era), and the names are jokes. Each icon becomes an <img>
 * once, which the game draws onto its canvas.
 */

export interface TossItem {
  name: string
  svg: string
}

const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 64 64">${body}</svg>`

/** A sheet of paper with a folded corner, for document icons. */
const page = (fill = '#fff') =>
  `<path d="M14 6h26l12 12v40H14z" fill="${fill}" stroke="#6b7c99" stroke-width="2" stroke-linejoin="round"/>` +
  `<path d="M40 6v12h12" fill="#dde4ee" stroke="#6b7c99" stroke-width="2" stroke-linejoin="round"/>`

/** A coloured file-type badge across the lower left of a page. */
const badge = (label: string, color: string) =>
  `<rect x="6" y="34" width="30" height="16" rx="2" fill="${color}" stroke="#0003" stroke-width="1"/>` +
  `<text x="21" y="46" text-anchor="middle" font-family="Tahoma, Arial, sans-serif" font-weight="700" font-size="11" fill="#fff">${label}</text>`

const folder = (front: string) =>
  `<defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe38f"/><stop offset="1" stop-color="#efbd45"/></linearGradient></defs>` +
  `<path d="M6 14h18l5 5h29v35H6z" fill="#e2ae3c" stroke="#a5781b" stroke-width="2" stroke-linejoin="round"/>` +
  `<path d="M6 25h52v29H6z" fill="url(#f)" stroke="#a5781b" stroke-width="2" stroke-linejoin="round"/>` +
  front

export const ITEMS: TossItem[] = [
  {
    name: 'Final_FINAL_v3.doc',
    svg: svg(page() + '<path d="M20 22h24M20 27h24M38 33h8M38 38h8M38 43h8M20 54h26" stroke="#9db0cf" stroke-width="2"/>' + badge('DOC', '#2b5cb8')),
  },
  {
    name: 'Taxes_2004.xls',
    svg: svg(
      page() +
        '<path d="M20 20h26v30H20zM20 26h26M20 32h26M29 20v14M38 20v30" fill="none" stroke="#7fb27f" stroke-width="1.5"/>' +
        badge('XLS', '#2e8b3a'),
    ),
  },
  {
    name: 'Notpad.exe',
    svg: svg(
      '<defs><linearGradient id="n" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#dfe8f5"/></linearGradient></defs>' +
        '<rect x="12" y="9" width="40" height="49" rx="2" fill="url(#n)" stroke="#5a6d8c" stroke-width="2"/>' +
        '<rect x="12" y="9" width="40" height="9" fill="#5b8fd6" stroke="#2f5a9e" stroke-width="2"/>' +
        '<path d="M18 26h28M18 33h28M18 40h28M18 47h18" stroke="#9db4d6" stroke-width="2"/>' +
        '<g fill="#fff" stroke="#555" stroke-width="1.5"><circle cx="19" cy="9" r="3"/><circle cx="28" cy="9" r="3"/><circle cx="37" cy="9" r="3"/><circle cx="46" cy="9" r="3"/></g>',
    ),
  },
  {
    name: 'Painter.exe',
    svg: svg(
      '<path d="M32 8C16 8 6 19 6 32s10 24 22 24c5 0 6-4 4-7-2-4 0-7 5-7h8c8 0 13-5 13-12C58 18 47 8 32 8z" fill="#f1d9a8" stroke="#8a6232" stroke-width="2"/>' +
        '<circle cx="18" cy="25" r="4.5" fill="#e23b3b"/><circle cx="30" cy="17" r="4.5" fill="#2b6fe0"/><circle cx="43" cy="20" r="4.5" fill="#2fae3c"/><circle cx="15" cy="38" r="4.5" fill="#f4c20d"/>' +
        '<path d="M57 9 38 31" stroke="#b5651d" stroke-width="5" stroke-linecap="round"/>' +
        '<path d="M38 30l-7 8 3 3 7-7z" fill="#7a3fd1" stroke="#4b2287" stroke-width="1.5" stroke-linejoin="round"/>',
    ),
  },
  {
    name: 'Mindsweeper.exe',
    svg: svg(
      '<rect x="6" y="6" width="52" height="52" fill="#c0c0c0"/><path d="M6 58V6h52" fill="none" stroke="#fff" stroke-width="3"/><path d="M6 58h52V6" fill="none" stroke="#7b7b7b" stroke-width="3"/>' +
        '<path d="M32 13v38M13 32h38M19 19l26 26M45 19 19 45" stroke="#000" stroke-width="3.5" stroke-linecap="round"/>' +
        '<circle cx="32" cy="32" r="12" fill="#000"/><rect x="25" y="25" width="5" height="5" fill="#fff"/>',
    ),
  },
  {
    name: 'Solitaire (Work Edition)',
    svg: svg(
      '<g transform="rotate(-12 32 32)"><rect x="9" y="10" width="32" height="44" rx="3" fill="#2a5ab8" stroke="#123a80" stroke-width="2"/><rect x="13" y="14" width="24" height="36" rx="2" fill="none" stroke="#9cc0ff" stroke-width="1.5"/></g>' +
        '<g transform="rotate(10 32 32)"><rect x="23" y="10" width="32" height="44" rx="3" fill="#fff" stroke="#555" stroke-width="2"/>' +
        '<text x="27" y="23" font-family="Arial, sans-serif" font-weight="700" font-size="11">A</text>' +
        '<path d="M39 26c-6 6-10 9-10 13 0 3 3 5 6 4l-2 5h12l-2-5c3 1 6-1 6-4 0-4-4-7-10-13z"/></g>',
    ),
  },
  {
    name: 'Clipper.exe',
    svg: svg(
      '<path d="M26 50V16a9 9 0 0 1 18 0v34a13 13 0 0 1-26 0V24" fill="none" stroke="#8592a6" stroke-width="4.5" stroke-linecap="round"/>' +
        '<path d="M26 50V16a9 9 0 0 1 18 0v34a13 13 0 0 1-26 0V24" fill="none" stroke="#dfe5ee" stroke-width="1.5" stroke-linecap="round"/>' +
        '<g stroke="#333" stroke-width="1.5"><circle cx="28" cy="27" r="5.5" fill="#fff"/><circle cx="41" cy="25" r="5.5" fill="#fff"/></g>' +
        '<circle cx="29.5" cy="28" r="2.3"/><circle cx="42.5" cy="26" r="2.3"/>' +
        '<path d="M23 19l8 2M37 17l8 1" stroke="#333" stroke-width="2" stroke-linecap="round"/>',
    ),
  },
  {
    name: 'Disk 1 of 47',
    svg: svg(
      '<path d="M8 8h44l4 4v44H8z" fill="#2d3e66" stroke="#141d33" stroke-width="2" stroke-linejoin="round"/>' +
        '<rect x="20" y="8" width="24" height="16" fill="#c9ced8" stroke="#141d33" stroke-width="1.5"/><rect x="34" y="11" width="6" height="10" fill="#2d3e66"/>' +
        '<rect x="14" y="31" width="36" height="22" fill="#fff"/><path d="M17 37h30" stroke="#d33" stroke-width="2"/><path d="M17 43h30M17 48h20" stroke="#99a" stroke-width="2"/>',
    ),
  },
  {
    // A web globe in a diving mask and snorkel, with a mouse pointer surfing it.
    name: 'Internet Diver',
    svg: svg(
      '<defs><radialGradient id="g" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#8fd0ff"/><stop offset="1" stop-color="#1c5fc9"/></radialGradient></defs>' +
        '<circle cx="29" cy="35" r="23" fill="url(#g)" stroke="#0d3a8a" stroke-width="2"/>' +
        '<path d="M13 40c3-3 8-3 10 0s-1 6 2 8-1 6-5 5-6-5-8-6c-1-2 0-5 1-7zM35 45c3-2 7-1 9 1s-1 6-4 6-5-3-5-7z" fill="#5cc46a"/>' +
        '<ellipse cx="29" cy="35" rx="9" ry="23" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.5"/>' +
        '<path d="M6 35h46M9 46h40" stroke="#fff" stroke-opacity=".55" stroke-width="1.5"/>' +
        '<path d="M7 25q22-8 44 0" fill="none" stroke="#1d1f22" stroke-width="3"/>' +
        '<rect x="13" y="17" width="32" height="14" rx="6" fill="#ffd23f" stroke="#b37a00" stroke-width="2"/>' +
        '<rect x="16" y="19.5" width="12" height="9" rx="3" fill="#d6f2ff" stroke="#b37a00" stroke-width="1.5"/><rect x="30" y="19.5" width="12" height="9" rx="3" fill="#d6f2ff" stroke="#b37a00" stroke-width="1.5"/>' +
        '<path d="M50 33V7h6" fill="none" stroke="#ff7a1a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M43 42l0 16 4-4 3 6 3-1.5-3-6 5.5-.5z" fill="#fff" stroke="#000" stroke-width="1.5" stroke-linejoin="round"/>',
    ),
  },
  {
    name: 'Media Playa',
    svg: svg(
      '<defs><linearGradient id="d" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8eef7"/><stop offset=".35" stop-color="#c9f0ff"/><stop offset=".55" stop-color="#ffe0f4"/><stop offset=".75" stop-color="#fff6c8"/><stop offset="1" stop-color="#b9c4d4"/></linearGradient></defs>' +
        '<circle cx="30" cy="30" r="25" fill="url(#d)" stroke="#7d8798" stroke-width="2"/><circle cx="30" cy="30" r="9" fill="#d9dee7" stroke="#7d8798" stroke-width="1.5"/><circle cx="30" cy="30" r="3.5" fill="#fff" stroke="#7d8798" stroke-width="1.5"/>' +
        '<circle cx="47" cy="47" r="13" fill="#f28c1b" stroke="#b55a00" stroke-width="2"/><path d="M43 40v14l12-7z" fill="#fff"/>',
    ),
  },
  {
    name: 'Unexpected Error',
    svg: svg(
      '<defs><radialGradient id="e" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#ff8a7a"/><stop offset="1" stop-color="#c81010"/></radialGradient></defs>' +
        '<circle cx="32" cy="32" r="25" fill="url(#e)" stroke="#7a0000" stroke-width="2"/><path d="M22 22l20 20M42 22 22 42" stroke="#fff" stroke-width="7" stroke-linecap="round"/>',
    ),
  },
  { name: 'New Folder (37)', svg: svg(folder('')) },
  {
    name: 'DO_NOT_DELETE.zip',
    svg: svg(
      folder(
        '<rect x="28" y="25" width="8" height="29" fill="#8d96a3"/><path d="M28 28h8M28 32h8M28 36h8M28 40h8M28 44h8M28 48h8" stroke="#4f5764" stroke-width="1.5"/>' +
          '<rect x="27" y="36" width="10" height="9" rx="1.5" fill="#d6dbe2" stroke="#4f5764" stroke-width="1.5"/>',
      ),
    ),
  },
  {
    name: 'Not Responding',
    svg: svg(
      '<rect x="14" y="6" width="36" height="6" rx="2" fill="#8b5a2b" stroke="#5a3814" stroke-width="1.5"/><rect x="14" y="52" width="36" height="6" rx="2" fill="#8b5a2b" stroke="#5a3814" stroke-width="1.5"/>' +
        '<path d="M18 12h28c0 10-10 14-10 20s10 10 10 20H18c0-10 10-14 10-20s-10-10-10-20z" fill="#e6f2ff" stroke="#6b8fb5" stroke-width="2"/>' +
        '<path d="M22 16h20c-2 5-8 8-10 12-2-4-8-7-10-12z" fill="#f0b44c"/><path d="M32 40c4 4 12 6 12 10H20c0-4 8-6 12-10z" fill="#f0b44c"/>',
    ),
  },
  {
    name: 'bluescreen.png',
    svg: svg(
      '<rect x="4" y="11" width="56" height="42" fill="#1c3fbf" stroke="#0e2580" stroke-width="2"/>' +
        '<path d="M10 19h22M10 25h42M10 31h36M10 37h20M10 43h32" stroke="#fff" stroke-width="2.5"/>',
    ),
  },
  {
    name: 'Calc-u-later.exe',
    svg: svg(
      '<rect x="12" y="5" width="40" height="54" rx="4" fill="#d8dbe2" stroke="#5f6775" stroke-width="2"/><rect x="17" y="10" width="30" height="11" fill="#c8e3c0" stroke="#5f6775" stroke-width="1.5"/>' +
        '<text x="44" y="19" text-anchor="end" font-family="Courier New, monospace" font-weight="700" font-size="9" fill="#234">2+2=5</text>' +
        '<g fill="#fff" stroke="#5f6775" stroke-width="1.2"><rect x="17" y="26" width="8" height="6"/><rect x="28" y="26" width="8" height="6"/><rect x="39" y="26" width="8" height="6" fill="#f2a65a"/>' +
        '<rect x="17" y="35" width="8" height="6"/><rect x="28" y="35" width="8" height="6"/><rect x="39" y="35" width="8" height="6" fill="#f2a65a"/>' +
        '<rect x="17" y="44" width="8" height="6"/><rect x="28" y="44" width="8" height="6"/><rect x="39" y="44" width="8" height="10" fill="#f2a65a"/><rect x="17" y="53" width="19" height="1"/></g>',
    ),
  },
  {
    name: 'missing.dll',
    svg: svg(
      page('#f3f5f9') +
        '<circle cx="31" cy="36" r="11" fill="none" stroke="#7a8597" stroke-width="6" stroke-dasharray="4.3 4.3"/><circle cx="31" cy="36" r="8.5" fill="#9aa5b8" stroke="#5f6a7d" stroke-width="1.5"/><circle cx="31" cy="36" r="3" fill="#fff"/>' +
        '<text x="46" y="56" text-anchor="middle" font-family="Tahoma, Arial, sans-serif" font-weight="700" font-size="12" fill="#c81010">?</text>',
    ),
  },
  {
    name: 'totally_legal_song.mp3',
    svg: svg(
      page() +
        '<path d="M29 46V23l16-4v22" fill="none" stroke="#1b5fbf" stroke-width="3" stroke-linejoin="round"/>' +
        '<ellipse cx="25" cy="46" rx="5" ry="4" fill="#1b5fbf"/><ellipse cx="41" cy="41" rx="5" ry="4" fill="#1b5fbf"/>',
    ),
  },
  {
    name: 'Printer (Offline)',
    svg: svg(
      '<path d="M18 6h22l6 6v14H18z" fill="#fff" stroke="#6b7c99" stroke-width="2" stroke-linejoin="round"/>' +
        '<rect x="6" y="22" width="52" height="24" rx="4" fill="#c9ccd3" stroke="#555c68" stroke-width="2"/><rect x="14" y="40" width="36" height="16" fill="#fff" stroke="#6b7c99" stroke-width="2"/>' +
        '<path d="M19 46h26M19 51h18" stroke="#9db0cf" stroke-width="2"/><circle cx="50" cy="30" r="2.8" fill="#e33" stroke="#900" stroke-width="1"/>',
    ),
  },
  {
    name: 'Shortcut to Shortcut',
    svg: svg(
      '<rect x="12" y="4" width="44" height="44" fill="#fff" stroke="#888" stroke-width="2"/>' +
        '<rect x="6" y="14" width="44" height="44" fill="#fff" stroke="#555" stroke-width="2"/>' +
        '<path d="M15 50c0-14 8-22 21-22v-8l11 12-11 12v-8c-9 0-16 4-21 14z" fill="#1f56c2" stroke="#0d3488" stroke-width="1.5" stroke-linejoin="round"/>',
    ),
  },
  {
    name: 'totally_legal_movie.mp4',
    svg: svg(
      '<rect x="8" y="26" width="48" height="30" rx="2" fill="#2b2b2b" stroke="#111" stroke-width="2"/>' +
        '<path d="M13 37h38M13 44h26M13 50h18" stroke="#ddd" stroke-width="2"/>' +
        '<g transform="rotate(-16 9 25)"><rect x="8" y="14" width="48" height="10" fill="#fff" stroke="#111" stroke-width="2"/>' +
        '<path d="M12 14h6l6 10h-6zM28 14h6l6 10h-6zM44 14h6l6 10h-6z" fill="#111"/></g>' +
        '<circle cx="10" cy="25" r="3" fill="#9aa0a8" stroke="#111" stroke-width="1.5"/>',
    ),
  },
  {
    name: 'totally_legal_rom.zip',
    svg: svg(
      '<path d="M10 6h44v46l-4 6H14l-4-6z" fill="#9aa0a8" stroke="#4d5259" stroke-width="2" stroke-linejoin="round"/>' +
        '<rect x="16" y="12" width="32" height="26" rx="2" fill="#e8463a" stroke="#9c231a" stroke-width="1.5"/>' +
        '<path d="M32 16l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6L23 23l6-1z" fill="#ffd23f" stroke="#b37a00" stroke-width="1"/>' +
        '<path d="M18 44h28M18 49h28" stroke="#6b7178" stroke-width="2"/>',
    ),
  },
  {
    // Steam, the kind a kettle makes.
    name: 'Steem',
    svg: svg(
      '<circle cx="32" cy="32" r="26" fill="#1b2838" stroke="#0b121b" stroke-width="2"/>' +
        '<path d="M23 29Q32 4 41 29" fill="none" stroke="#66c0f4" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M43 41l9-9" stroke="#66c0f4" stroke-width="7" stroke-linecap="round"/><path d="M43 41l9-9" stroke="#c7d5e0" stroke-width="4" stroke-linecap="round"/>' +
        '<path d="M19 49h26c2 0 3-1.5 2.6-3.5l-2.8-11.5a6 6 0 0 0-5.8-4.5H25a6 6 0 0 0-5.8 4.5l-2.8 11.5c-.4 2 .6 3.5 2.6 3.5z" fill="#c7d5e0" stroke="#66c0f4" stroke-width="2"/>' +
        '<rect x="24" y="26" width="16" height="4" rx="2" fill="#c7d5e0" stroke="#66c0f4" stroke-width="1.5"/><circle cx="32" cy="23.5" r="2.5" fill="#c7d5e0"/>' +
        '<path d="M49 28q-3-3 0-6t0-6M54 30q-2.5-2.5 0-5t0-5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>',
    ),
  },
  {
    name: 'Dischord.exe',
    svg: svg(
      '<path d="M10 10h44a4 4 0 0 1 4 4v28a4 4 0 0 1-4 4H30l-13 11V46h-7a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4z" fill="#5865f2" stroke="#3c45a5" stroke-width="2" stroke-linejoin="round"/>' +
        '<ellipse cx="23" cy="28" rx="4" ry="5" fill="#fff"/><ellipse cx="41" cy="28" rx="4" ry="5" fill="#fff"/>' +
        '<path d="M17 19l9 3M47 19l-9 3M25 40q7-5 14 0" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>',
    ),
  },
  {
    name: 'Visual Studi-oh-no',
    svg: svg(
      '<rect x="5" y="5" width="52" height="52" rx="10" fill="#6c33af" stroke="#43206e" stroke-width="2"/>' +
        '<path d="M21 20l-10 11 10 11M41 20l10 11-10 11M35 16l-8 30" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<circle cx="50" cy="50" r="10" fill="#e23b3b" stroke="#fff" stroke-width="2"/>' +
        '<path d="M50 44v7" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="50" cy="55" r="1.7" fill="#fff"/>',
    ),
  },
  {
    name: 'Photoslop.exe',
    svg: svg(
      '<rect x="6" y="6" width="52" height="52" rx="7" fill="#0a1f33" stroke="#31a8ff" stroke-width="3"/>' +
        '<text x="32" y="42" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="24" fill="#31a8ff">SL</text>' +
        '<path d="M20 50h24" stroke="#31a8ff" stroke-width="2"/><path d="M38 50v5a2.5 2.5 0 0 0 5 0v-5" fill="#31a8ff"/>',
    ),
  },
  {
    name: 'BitTorment.exe',
    svg: svg(
      '<circle cx="32" cy="26" r="20" fill="#3fa63f" stroke="#246b24" stroke-width="2"/>' +
        '<path d="M32 14v21M23 27l9 9 9-9" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<rect x="5" y="51" width="54" height="8" fill="#fff" stroke="#555" stroke-width="1.5"/><rect x="6.5" y="52.5" width="3" height="5" fill="#3fa63f"/>',
    ),
  },
  {
    name: 'CPU (Overclocked)',
    svg: svg(
      '<path d="M18 6v6M26 6v6M34 6v6M42 6v6M18 52v6M26 52v6M34 52v6M42 52v6M6 18h6M6 26h6M6 34h6M6 42h6M52 18h6M52 26h6M52 34h6M52 42h6" stroke="#d4a537" stroke-width="3"/>' +
        '<rect x="12" y="12" width="40" height="40" rx="3" fill="#2a6b45" stroke="#163d26" stroke-width="2"/>' +
        '<rect x="18" y="18" width="28" height="28" rx="2" fill="#cfd4da" stroke="#7d858f" stroke-width="2"/>' +
        '<text x="32" y="35" text-anchor="middle" font-family="Tahoma, Arial, sans-serif" font-weight="700" font-size="9" fill="#5f6775">CPU</text>' +
        '<path d="M53 1c4 5 7 9 5 13-1 3-5 5-8 3-3-2-3-6-1-9 0 3 2 4 3 2 1-3 0-6 1-9z" fill="#ff7a1a" stroke="#c2410c" stroke-width="1"/>',
    ),
  },
  {
    name: 'GPU',
    svg: svg(
      '<rect x="2" y="12" width="5" height="40" fill="#b8bec6" stroke="#6b7178" stroke-width="1.5"/>' +
        '<rect x="14" y="44" width="34" height="7" fill="#d4a537" stroke="#8a6a1a" stroke-width="1.5"/>' +
        '<rect x="6" y="16" width="56" height="30" rx="3" fill="#2b2f36" stroke="#111" stroke-width="2"/>' +
        '<g stroke="#111" stroke-width="1.5"><circle cx="21" cy="31" r="11" fill="#444b55"/><circle cx="47" cy="31" r="11" fill="#444b55"/></g>' +
        '<g fill="none" stroke="#9aa3ae" stroke-width="7" stroke-dasharray="3 3"><circle cx="21" cy="31" r="6"/><circle cx="47" cy="31" r="6"/></g>' +
        '<circle cx="21" cy="31" r="2.5" fill="#2b2f36"/><circle cx="47" cy="31" r="2.5" fill="#2b2f36"/>',
    ),
  },
  {
    name: 'RAM',
    svg: svg(
      '<rect x="4" y="19" width="56" height="22" rx="1.5" fill="#2a7d4a" stroke="#14462a" stroke-width="2"/>' +
        '<g fill="#1d1f22"><rect x="8" y="23" width="9" height="11"/><rect x="20" y="23" width="9" height="11"/><rect x="35" y="23" width="9" height="11"/><rect x="47" y="23" width="9" height="11"/></g>' +
        '<path d="M6 43.5h52" stroke="#d4a537" stroke-width="5" stroke-dasharray="2 1.2"/>',
    ),
  },
  {
    name: 'PC Case',
    svg: svg(
      '<defs><linearGradient id="r"><stop offset="0" stop-color="#ff3b3b"/><stop offset=".33" stop-color="#ffd23f"/><stop offset=".66" stop-color="#3bdc6b"/><stop offset="1" stop-color="#3b8bff"/></linearGradient></defs>' +
        '<rect x="16" y="4" width="32" height="56" rx="3" fill="#30343b" stroke="#111" stroke-width="2"/>' +
        '<rect x="20" y="9" width="24" height="5" fill="#4a5059"/><rect x="20" y="16" width="24" height="5" fill="#4a5059"/>' +
        '<circle cx="32" cy="29" r="3.5" fill="none" stroke="#5ad1ff" stroke-width="2"/>' +
        '<path d="M21 39h22M21 44h22M21 49h22M21 54h22" stroke="url(#r)" stroke-width="2.5"/>',
    ),
  },
  {
    name: 'Power Supply',
    svg: svg(
      '<rect x="4" y="12" width="56" height="40" rx="2" fill="#5d636b" stroke="#2a2e33" stroke-width="2"/>' +
        '<circle cx="23" cy="32" r="14" fill="#3a3f45" stroke="#2a2e33" stroke-width="1.5"/>' +
        '<g fill="none" stroke="#8a919a" stroke-width="1.5"><circle cx="23" cy="32" r="9.5"/><circle cx="23" cy="32" r="4.5"/><path d="M9 32h28M23 18v28"/></g>' +
        '<rect x="43" y="17" width="12" height="9" rx="1" fill="#1d1f22"/>' +
        '<rect x="41" y="32" width="16" height="13" fill="#ffd23f" stroke="#b37a00" stroke-width="1"/>' +
        '<text x="49" y="41.5" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="6">2000W</text>',
    ),
  },
  {
    name: 'System32',
    svg: svg(
      folder(
        '<circle cx="40" cy="41" r="8.5" fill="none" stroke="#6b7480" stroke-width="5" stroke-dasharray="3.3 3.4"/>' +
          '<circle cx="40" cy="41" r="7" fill="#9aa5b8" stroke="#5f6a7d" stroke-width="1.5"/><circle cx="40" cy="41" r="2.6" fill="#ffe38f"/>',
      ),
    ),
  },
]

const images = new Map<number, HTMLImageElement>()

/** The item's icon as an image for the canvas. It may still be loading on the first frame or two. */
export function itemImage(index: number): HTMLImageElement {
  let img = images.get(index)
  if (!img) {
    img = new Image()
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ITEMS[index].svg)}`
    images.set(index, img)
  }
  return img
}

/** A random item, never the same one twice in a row. */
export function pickItem(previous: number): number {
  if (previous < 0) return Math.floor(Math.random() * ITEMS.length)
  const next = Math.floor(Math.random() * (ITEMS.length - 1))
  return next >= previous ? next + 1 : next
}
