import type { Color } from 'chess.js'
import { usePlayerProfile } from '../hooks/usePlayerProfile'

export function PlayerAvatar({ name, color, size, className }: { name: string; color: Color; size: number; className?: string }) {
  const profile = usePlayerProfile(name)
  return <img className={className} src={profile?.avatar ?? `/players/${color === 'w' ? 'white' : 'black'}.png`} width={size} height={size} alt="" />
}
