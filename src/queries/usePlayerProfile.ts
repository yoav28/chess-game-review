import { useQuery } from '@tanstack/react-query';

import type { Site } from '../stores/useSelectGameStore';

export interface PlayerProfile {
  avatar: string | null;
  country: string | null;
}

export async function fetchPlayerProfile(site: Site, username: string, signal?: AbortSignal): Promise<PlayerProfile | null> {
  const response = await fetch(site === 'chess.com'
    ? `https://api.chess.com/pub/player/${encodeURIComponent(username)}`
    : `https://lichess.org/api/user/${encodeURIComponent(username)}`, { signal });

  if (!response.ok)
    return null;

  const profile = await response.json();
  const country = site === 'chess.com' ? profile.country : profile.profile?.flag || profile.profile?.country;

  return {
    avatar: site === 'chess.com' && typeof profile.avatar === 'string' && /^https?:\/\//.test(profile.avatar) ? profile.avatar : null,
    country: typeof country === 'string' ? country : null,
  };
}

export default function usePlayerProfile(site: Site | undefined, username: string | undefined) {
  const name = username?.trim().toLowerCase();

  return useQuery({
    queryKey: ['playerProfile', site, name],
    queryFn: ({ signal }) => fetchPlayerProfile(site!, name!, signal),
    enabled: !!site && !!name && !name.startsWith('lichess ai'),
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });
}
