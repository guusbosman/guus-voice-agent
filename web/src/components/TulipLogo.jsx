export default function TulipLogo() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" className="tulip-logo" role="img">
      <defs>
        <linearGradient id="petalGradient" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#ff7a59" />
          <stop offset="100%" stopColor="#d43c6a" />
        </linearGradient>
        <linearGradient id="leafGradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#3ba86d" />
          <stop offset="100%" stopColor="#1d6f47" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="56" fill="#fffaf2" />
      <path d="M34 75c8-5 13-12 15-24 6 4 9 9 11 15 2-6 5-11 11-15 2 12 7 19 15 24-8 5-16 8-26 8s-18-3-26-8z" fill="url(#petalGradient)"/>
      <path d="M59 82h2v22h-2z" fill="#2b8f5a" />
      <path d="M59 88c-10 0-17 7-19 16 7-1 13-4 19-9v-7z" fill="url(#leafGradient)" />
      <path d="M61 88c10 0 17 7 19 16-7-1-13-4-19-9v-7z" fill="url(#leafGradient)" />
    </svg>
  )
}
