export default function CountryFlag({ country }: { country?: string | null }) {
  const code = country?.split('/').pop()?.toUpperCase();
  if (!code || !/^[A-Z]{2}$/.test(code))
    return null;
  const flag = String.fromCodePoint(...[...code].map(char => char.charCodeAt(0) + 127397));

  return <span aria-label={`Country: ${code}`} className="shrink-0 text-sm" role="img" title={code}>{flag}</span>;
}
