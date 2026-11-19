import type { CSSProperties } from 'react'

// Each player gets a bright ball colour, picked from their name.
// Saturated on purpose: the 3D shading in app.css darkens the edges a lot.
const BALLS = ['#ffbf1f', '#2f7bff', '#ff4545', '#9b5cff', '#ff7a1a', '#14c97a', '#ff4fa3']

function ballColor(name: string) {
  let hash = 0
  for (const ch of name.toLowerCase()) hash = (hash * 31 + ch.codePointAt(0)!) | 0
  return BALLS[Math.abs(hash) % BALLS.length]
}

export function PlayerBall({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initial = [...name.trim()][0]?.toUpperCase() ?? '?'
  return (
    <span
      className="player-ball"
      data-size={size}
      style={{ '--ball': ballColor(name) } as CSSProperties}
      aria-hidden="true"
    >
      <span className="player-ball__spot">{initial}</span>
    </span>
  )
}
