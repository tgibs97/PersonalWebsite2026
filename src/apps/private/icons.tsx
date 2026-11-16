import type { IconArt } from '../../os/types'

/** Icons for the members-only apps. They live here, not in the shared icon set, so guests never download them. */
export const giftIcon: IconArt = {
  art: (
    <>
      <defs>
        <linearGradient id="ic-gift-box" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f2574a" />
          <stop offset="1" stopColor="#c42f24" />
        </linearGradient>
      </defs>
      <rect x="9" y="23" width="30" height="18" rx="2" fill="url(#ic-gift-box)" stroke="#8e1f17" />
      <rect x="7" y="17" width="34" height="8" rx="2" fill="#f46a5c" stroke="#8e1f17" />
      <rect x="21" y="17" width="6" height="24" fill="#ffd24a" stroke="#c79614" strokeWidth=".8" />
      <ellipse cx="18.5" cy="13" rx="5.5" ry="4" transform="rotate(-25 18.5 13)" fill="#ffd24a" stroke="#c79614" strokeWidth=".8" />
      <ellipse cx="29.5" cy="13" rx="5.5" ry="4" transform="rotate(25 29.5 13)" fill="#ffd24a" stroke="#c79614" strokeWidth=".8" />
      <circle cx="24" cy="15.5" r="2.8" fill="#f2b32a" stroke="#c79614" strokeWidth=".8" />
      <path d="M41 6l1 2.5 2.5 1-2.5 1L41 13l-1-2.5-2.5-1 2.5-1z" fill="#fff6a0" stroke="#e0b21e" strokeWidth=".6" />
    </>
  ),
}

export const cruiseIcon: IconArt = {
  art: (
    <>
      <defs>
        <linearGradient id="ic-cruise-hull" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f5aa8" />
          <stop offset="1" stopColor="#1b3366" />
        </linearGradient>
      </defs>
      <path d="M5 29H43L38 38H10Z" fill="url(#ic-cruise-hull)" stroke="#142850" strokeLinejoin="round" />
      <path d="M6.5 32H41.5" stroke="#e0453a" strokeWidth="1.8" />
      <rect x="11" y="22" width="26" height="7" rx="1" fill="#fff" stroke="#9aa7bd" />
      <rect x="15" y="16" width="18" height="6" rx="1" fill="#fff" stroke="#9aa7bd" />
      <rect x="21" y="8" width="6" height="8" rx="1" fill="#e0453a" stroke="#a8261c" />
      <rect x="21" y="10.5" width="6" height="2" fill="#1b1b1b" />
      <g fill="#4a9af5">
        {[14, 18, 22, 26, 30, 34].map((x) => (
          <circle key={x} cx={x} cy="25.5" r="1.1" />
        ))}
        {[19, 23, 27, 31].map((x) => (
          <circle key={x} cx={x} cy="19" r="1" />
        ))}
      </g>
      <circle cx="26" cy="5" r="2.2" fill="#dfe6f0" opacity=".85" />
      <path d="M3 41c4-3 8-3 11 0s7 3 11 0 8-3 11 0 6 3 9 0" fill="none" stroke="#4a9af5" strokeWidth="2.4" strokeLinecap="round" />
    </>
  ),
}

export const mothershipIcon: IconArt = {
  art: (
    <>
      <defs>
        <radialGradient id="ic-ms-space" cx=".5" cy=".4" r=".8">
          <stop offset="0" stopColor="#1f3f8a" />
          <stop offset="1" stopColor="#050a22" />
        </radialGradient>
        <linearGradient id="ic-ms-hull" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#eef3fa" />
          <stop offset=".5" stopColor="#b4c0d4" />
          <stop offset="1" stopColor="#707e98" />
        </linearGradient>
        <radialGradient id="ic-ms-glow">
          <stop offset="0" stopColor="#ffb454" />
          <stop offset="1" stopColor="#ff7a2a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="3" y="3" width="42" height="42" rx="6" fill="url(#ic-ms-space)" stroke="#0a1a4a" />
      <g fill="#fff">
        <circle cx="10" cy="10" r="1" />
        <circle cx="38" cy="9" r=".9" />
        <circle cx="8" cy="37" r=".8" />
        <circle cx="39" cy="38" r="1" />
        <circle cx="20" cy="7" r=".7" />
        <circle cx="33" cy="41" r=".7" />
        <circle cx="42" cy="22" r=".7" />
      </g>
      <circle cx="9" cy="26" r="6" fill="url(#ic-ms-glow)" />
      <path d="M8 26L14 20H32L42 26L32 32H14Z" fill="url(#ic-ms-hull)" stroke="#4a5670" strokeWidth=".9" strokeLinejoin="round" />
      <rect x="20" y="15" width="10" height="6" rx="2.5" fill="#7fd0ff" stroke="#3a6a96" strokeWidth=".8" />
      <path d="M22 17h4" stroke="#fff" strokeWidth="1" opacity=".7" />
      <g fill="#ffe27a">
        {[16, 21, 26, 31].map((x) => (
          <circle key={x} cx={x} cy="26" r="1.2" />
        ))}
      </g>
      <path d="M14 30H34" stroke="#4a5670" strokeWidth=".8" opacity=".6" />
    </>
  ),
}
