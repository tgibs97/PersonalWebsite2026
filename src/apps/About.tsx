import { site } from '../site'

export function About() {
  return (
    <div className="app-page">
      <h1>About {site.owner}</h1>
      <p>Welcome to my corner of the internet.</p>
      <p className="placeholder">
        Placeholder: this window is a stub. Real content goes here.
      </p>
    </div>
  )
}
