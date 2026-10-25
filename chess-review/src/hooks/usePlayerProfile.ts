import { useEffect, useState } from 'react'

export type PlayerProfile = { avatar: string | null; title: string | null }

const profileCache = new Map<string, PlayerProfile | null>()
const profileRequests = new Map<string, Promise<PlayerProfile | null>>()

export function usePlayerProfile(username: string) {
  const normalized = username.trim().toLowerCase()
  const [profile, setProfile] = useState<PlayerProfile | null>(() => profileCache.get(normalized) ?? null)

  useEffect(() => {
    if (!normalized) return
    const cached = profileCache.get(normalized)
    if (cached !== undefined) {
      setProfile(cached)
      return
    }
    let active = true
    let request = profileRequests.get(normalized)
    if (!request) {
      request = fetch(`https://api.chess.com/pub/player/${encodeURIComponent(normalized)}`)
        .then(async response => {
          if (!response.ok) return null
          const data = await response.json()
          const avatar = typeof data.avatar === 'string' && /^https?:\/\//.test(data.avatar) ? data.avatar : null
          const title = typeof data.title === 'string' ? data.title : null
          return { avatar, title }
        })
        .catch(() => null)
      profileRequests.set(normalized, request)
    }
    void request.then(result => {
      profileCache.set(normalized, result)
      if (active) setProfile(result)
    })
    return () => { active = false }
  }, [normalized])

  return profile
}
