import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Desktop } from './os/Desktop'
import { startTracking } from './os/track'
import { WindowsProvider } from './os/windows'
import './styles/global.css'
import './styles/luna.css'
import './styles/wallpaper.css'
import './styles/browser.css'
import './styles/paper-toss.css'
import './styles/photos.css'

startTracking(window.location.pathname.replace(/^\/+|\/+$/g, ''))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WindowsProvider>
      <Desktop />
    </WindowsProvider>
  </StrictMode>,
)
