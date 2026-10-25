export function CountryFlag({ country }: { country?: string | null }) {
  const code = country?.split('/').pop()?.toUpperCase()
  if (!code || !/^[A-Z]{2}$/.test(code)) return null
  const flag = String.fromCodePoint(...[...code].map(char => char.charCodeAt(0) + 127397))
  return <span className="player-flag" role="img" aria-label={`Country: ${code}`} title={code}>{flag}</span>
}
