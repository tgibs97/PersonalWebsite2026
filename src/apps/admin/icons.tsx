import type { IconArt } from '../../os/types'

/** Icons for the admin-only apps. They live here, not in the shared icon set, so nobody else downloads them. */
export const chartIcon: IconArt = {
  art: (
    <>
      <defs>
        <linearGradient id="ic-an-paper" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#dfe8f6" />
        </linearGradient>
      </defs>
      <rect x="6" y="6" width="36" height="36" rx="3" fill="url(#ic-an-paper)" stroke="#5a7bb5" />
      <path d="M11 36h26" stroke="#8aa1c8" strokeWidth="1.5" />
      <rect x="12" y="25" width="5" height="11" fill="#4a9af5" stroke="#1f5fb8" strokeWidth=".8" />
      <rect x="20" y="17" width="5" height="19" fill="#3fae4a" stroke="#22762c" strokeWidth=".8" />
      <rect x="28" y="21" width="5" height="15" fill="#f5a623" stroke="#b36f00" strokeWidth=".8" />
      <path d="M11 24l9-8 8 4 9-10" fill="none" stroke="#e0453a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="37" cy="10" r="2.2" fill="#e0453a" />
    </>
  ),
}

/** Control Panel: a pale panel with three slider switches. */
export const controlPanelIcon: IconArt = {
  art: (
    <>
      <defs>
        <linearGradient id="ic-cp-panel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fdfdf8" />
          <stop offset="1" stopColor="#d9d6c3" />
        </linearGradient>
      </defs>
      <rect x="5" y="7" width="38" height="34" rx="3" fill="url(#ic-cp-panel)" stroke="#7a7860" />
      <rect x="5" y="7" width="38" height="7" rx="3" fill="#2f6fd6" stroke="#1b4aa0" />
      <path d="M11 22h26M11 29h26M11 36h26" stroke="#8d8a74" strokeWidth="2" strokeLinecap="round" />
      <rect x="27" y="19" width="5" height="6" rx="1" fill="#3fae4a" stroke="#22762c" />
      <rect x="15" y="26" width="5" height="6" rx="1" fill="#e0453a" stroke="#9c2218" />
      <rect x="23" y="33" width="5" height="6" rx="1" fill="#f5a623" stroke="#b36f00" />
    </>
  ),
}
